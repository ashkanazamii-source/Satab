// pairing/pairing.controller.ts
import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, BadRequestException, Param, Sse, NotFoundException, Res } from '@nestjs/common';
import { PairingService } from './pairing.service';
import { IssueDto, RedeemDto } from '../dto/pairing.dto';
import { map, Observable } from 'rxjs';
import { Users } from 'src/users/users.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';



@Controller()
export class PairingController {
  private readonly logger = new Logger(PairingController.name);
  constructor(private readonly pairing: PairingService,
    @InjectDataSource() private readonly ds: DataSource,
  ) { }
  // بالای Controller (داخل کلاس) این‌ها را اضافه کن:
  private readonly TTL_MS = 60_000; // 60s
  private lastSeenUid = new Map<string, number>(); // hex8 -> expireAt(ms)

  // کمک‌تابع نرمال‌سازی به hex8
  private toHex8(val: string): string {
    const v = String(val || '').trim();
    if (/^[0-9a-fA-F]{8}$/.test(v)) return v.toUpperCase();
    if (/^[0-9a-fA-F]{16}$/.test(v)) return v.toUpperCase().slice(-8);
    if (/^\d{1,20}$/.test(v)) {
      const n = BigInt(v);
      if (n < 0n || n > 0xFFFFFFFFn) throw new BadRequestException('uid out of range');
      return n.toString(16).padStart(8, '0').toUpperCase();
    }
    throw new BadRequestException('bad uid');
  }

  @Post('pairing-codes')
  @HttpCode(201)
  async issue(@Body() dto: IssueDto, @Req() req: any) {
    this.logger.log(`ISSUE by user=${req?.user?.id ?? '-'} for userId=${dto.userId}`);
    return this.pairing.issue(dto.userId);
  }

  // برد اینو صدا می‌زنه: فقط vehicle_id برمی‌گرده
  @Post('pairing-codes/redeem')
  @HttpCode(200)
  async redeem(@Body() dto: RedeemDto) {
    return this.pairing.redeem(dto.code, dto.device_id);
  }

  // (اگه لازم نداری، می‌تونی حذفش کنی)
  @Get('pairing-codes/wait')
  @HttpCode(200)
  async wait(@Query('code') code: string) {
    if (!code || !/^\d{4}$/.test(code)) throw new BadRequestException('bad code');
    return this.pairing.wait(code);
  }

  // فرانت: ساخت pending
  @Post('pairing-codes/pending')
  @HttpCode(201)
  createPending(@Body() body: any) {
    const { expected_uid_hex, profile, expires_in } = body || {};
    if (!profile?.full_name || !profile?.phone || !profile?.password || !profile?.role_level || !profile?.parent_id) {
      throw new BadRequestException('invalid profile');
    }
    if (!expected_uid_hex) throw new BadRequestException('expected_uid_hex required');
    this.logger.log(`CREATE PENDING for full_name=${profile.full_name}`);
    return this.pairing.issuePending(expected_uid_hex, profile, Number(expires_in) || 60);
  }

  // فرانت: Polling وضعیت
  @Get('pairing-codes/pending/:id/status')
  @HttpCode(200)
  status(@Param('id') id: string) {
    return this.pairing.getStatus(id);
  }

  // برد: UID را گزارش می‌کند (Hex16 یا Decimal)
  @Post('pairing-codes/pending/:id/uid')
  @HttpCode(200)
  async submitUid(@Param('id') id: string, @Body() body: any) {
    const raw = body?.uid_hex ?? body?.uid_dec ?? body?.uid;
    if (!raw) throw new BadRequestException('uid is required');
    this.logger.log(`UID SUBMIT id=${id} raw=${raw}`);
    return this.pairing.submitUid(id, raw);
  }

  @Post('pairing-codes/arm')
  @HttpCode(200)
  async armUid(@Body() body: any) {
    const rawUserId = body?.user_id ?? body?.userId ?? body?.uid_user;
    const rawExpected = body?.expected_uid ?? body?.expected_uid_hex ?? body?.uid ?? body?.uid_hex ?? body?.uid_dec;

    if (rawUserId == null) {
      throw new BadRequestException('user_id is required');
    }
    if (!rawExpected) {
      throw new BadRequestException('expected_uid is required');
    }

    const userId = Number(rawUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('user_id must be a positive integer');
    }

    this.logger.debug(
      `[CTRL] arm | user_id=${userId} raw=${JSON.stringify(rawExpected)}`
    );

    try {
      const { hex8, user_id, expires_in } =
        await this.pairing.armUidForUser(userId, String(rawExpected));

      this.logger.debug(
        `[CTRL] arm | OK user_id=${user_id} hex=${hex8} ttl=${expires_in}s`
      );

      return { hex8, user_id, expires_in };
    } catch (err: any) {
      const st = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      this.logger.error(
        `[CTRL] arm | ERR status=${st} msg=${err?.message || err}`
      );
      throw err;
    }
  }
  // Controller
  @Post('pairing-codes/pending/uid')
  @HttpCode(200)
  async submitUidNoId(@Body() body: any) {
    const t0 = Date.now();
    const mask = (s: string, keep = 4) =>
      s ? `${String(s).slice(0, keep)}…${String(s).slice(-keep)}` : '';

    const uidRaw = body?.uid_hex ?? body?.uid_dec ?? body?.uid;

    this.logger.debug(`[pending/uid] start | uidRaw=${mask(uidRaw, 6)}`);

    if (!uidRaw) {
      this.logger.warn('[pending/uid] fail: uid missing');
      throw new BadRequestException('uid is required');
    }

    // اختیاری: فقط برای لاگ، نرمال‌سازی نمایش
    let uidHexForLog = '';
    try {
      uidHexForLog = this.toHex8(String(uidRaw));
      this.logger.debug(`[pending/uid] normalized | uidHex=${mask(uidHexForLog, 6)}`);
    } catch {
      // مهم نیست؛ خود سرویس داخلش نرمال می‌کند و خطا می‌دهد
    }

    try {
      // ✅ این سرویس اگر armed نباشه/منقضی شده باشه/استفاده شده باشه، خطای مناسب می‌دهد
      const { user_id } = await this.pairing.consumeArmedUid(String(uidRaw));

      this.logger.debug(
        `[pending/uid] success | user_id=${user_id} | dur=${Date.now() - t0}ms`
      );
      // فقط همین
      return { user_id };
    } catch (err: any) {
      const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      this.logger.error(
        `[pending/uid] error | status=${status} | msg=${err?.message || err} | dur=${Date.now() - t0}ms`
      );
      throw err;
    }
  }

  // PairingController
  @Get('pairing-codes/arm/check')
  @HttpCode(200)
  async checkArm(@Query('user_id') userIdRaw: string, @Query('hex8') hex8Raw?: string) {
    const userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId <= 0) throw new BadRequestException('bad user_id');

    const hex8 = (hex8Raw || '').trim().toUpperCase();
    const repo = this.ds.getRepository(Users); // ✅
    const u = await repo.findOne({ where: { id: userId }, select: { id: true, driver_card_hex: true } as any });
    if (!u) throw new NotFoundException('user not found');

    const current = (u.driver_card_hex || '').toUpperCase();
    const bound = !!current && (!hex8 || current === hex8);
    return { bound, driver_card_hex: current || null };
  }

  @Sse('pairing-codes/pending/:id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.pairing.sse(id);
  }
}
type EnsureDto = {
  uid?: string;
  uid_hex?: string;
  uid_dec?: string;
  profile?: {
    full_name?: string;
    phone?: string;
    password?: string;
    parent_id?: number;
  };
};

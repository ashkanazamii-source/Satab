// pairing/pairing.controller.ts
import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, BadRequestException, Param, Sse } from '@nestjs/common';
import { PairingService } from './pairing.service';
import { IssueDto, RedeemDto } from '../dto/pairing.dto';
import { map, Observable } from 'rxjs';

@Controller()
export class PairingController {
  private readonly logger = new Logger(PairingController.name);
  constructor(private readonly pairing: PairingService) { }

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


  @Post('pairing-codes/pending/uid')
  @HttpCode(200)
  async submitUidNoId(@Body() body: any) {
    this.logger.log(`[CTRL] /pairing-codes/pending/uid body=${JSON.stringify(body)}`);
    const raw = body?.uid_hex ?? body?.uid_dec ?? body?.uid;
    if (!raw) throw new BadRequestException('uid is required');
    this.logger.log(`UID SUBMIT (no id) raw=${raw}`);
    return this.pairing.submitUidByUidOnly(raw);
  }

  @Sse('pairing-codes/pending/:id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.pairing.sse(id);
  }
}

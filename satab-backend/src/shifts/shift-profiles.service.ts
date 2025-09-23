// src/shift-profiles/shift-profiles.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ShiftProfile } from './shift-profile.entity';
import { Shift, ShiftStatus, ShiftType } from '../shifts/shift.entity';

import { CreateShiftProfileDto } from '../dto/create-shift-profile.dto';
import { UpdateShiftProfileDto } from '../dto/update-shift-profile.dto';
import { ApplyShiftProfileDto } from '../dto/apply-shift-profile.dto';

/**
 * نکته‌ها:
 * - این سرویس یک متد «استاندارد» برای اعمال پروفایل دارد: `applyProfile`
 * - در صورت درخواست (wipe_first) ابتدا شیفت‌های قبلی پاک می‌شوند، سپس شیفت‌های جدید درج می‌شوند.
 * - درج‌ها به‌صورت bulk و در chunkهای ۵۰۰تایی انجام می‌گیرد.
 */
@Injectable()
export class ShiftProfilesService {
  constructor(
    @InjectRepository(ShiftProfile)
    private readonly repo: Repository<ShiftProfile>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  // ====== Queries ======
  async list(): Promise<ShiftProfile[]> {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  // ====== Create ======
  async create(dto: CreateShiftProfileDto): Promise<ShiftProfile> {
    if (!dto?.name || !dto?.payload) {
      throw new BadRequestException('نام و payload الزامی است');
    }

    // اعتبارسنجی ساده زمان
    assertTimeRange(dto.payload.start_time, dto.payload.end_time);

    const payload = {
      start_time: dto.payload.start_time,
      end_time: dto.payload.end_time,
      type: dto.payload.type as ShiftType,

      vehicle_id: numOrNull(dto.payload.vehicle_id),
      route_id: numOrNull(dto.payload.route_id),
      station_start_id: numOrNull(dto.payload.station_start_id),
      station_end_id: numOrNull(dto.payload.station_end_id),
      note: dto.payload.note ?? null,
      status: dto.payload.status ?? ShiftStatus.DRAFT,

      // تاریخ‌ها را پاکسازی/یونیک/مرتب کن
      apply_dates: Array.isArray(dto.payload.apply_dates)
        ? uniqYmd(dto.payload.apply_dates)
        : [],
    };

    const entity = this.repo.create({ name: dto.name.trim(), payload });
    return this.repo.save(entity);
  }

  // ====== Update ======
  async update(id: number, dto: UpdateShiftProfileDto): Promise<ShiftProfile> {
    const cur = await this.repo.findOne({ where: { id } });
    if (!cur) throw new NotFoundException('پروفایل پیدا نشد');

    if (dto.payload) {
      const p = { ...(cur.payload as any), ...dto.payload };

      // اگر ساعت‌ها تغییر کردند، اعتبار بگیر
      assertTimeRange(p.start_time, p.end_time);

      // نرمال‌سازی وضعیت و فیلدهای nullable
      p.status = p.status ?? ShiftStatus.DRAFT;
      p.vehicle_id = numOrNull(p.vehicle_id);
      p.route_id = numOrNull(p.route_id);
      p.station_start_id = numOrNull(p.station_start_id);
      p.station_end_id = numOrNull(p.station_end_id);
      p.note = p.note ?? null;

      if (Array.isArray(p.apply_dates)) {
        p.apply_dates = uniqYmd(p.apply_dates);
      }

      cur.payload = p;
    }

    if (dto.name != null) {
      cur.name = String(dto.name).trim();
    }

    return this.repo.save(cur);
  }

  // ====== Delete ======
  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * اعمال پروفایل:
   * ورودی:
   *  - driver_ids: number[]
   *  - dates?: string[] (YYYY-MM-DD). اگر خالی باشد از apply_dates پروفایل استفاده می‌شود.
   *  - publish?: boolean  → اگر true باشد status = PUBLISHED (وگرنه از status پروفایل)
   *  - wipe_first?: boolean
   *  - wipe_scope?: 'all' | 'dates'  → دامنه پاکسازی
   */
  async applyProfile(profileId: number, dto: ApplyShiftProfileDto) {
    const profile = await this.repo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('پروفایل یافت نشد');

    const p = (profile.payload || {}) as {
      start_time: string;
      end_time: string;
      type: ShiftType;
      vehicle_id?: number | null;
      route_id?: number | null;
      station_start_id?: number | null;
      station_end_id?: number | null;
      note?: string | null;
      status?: ShiftStatus;
      apply_dates?: string[];
    };

    // === اعتبار ورودی‌ها ===
    const driverIds = (dto.driver_ids || [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (!driverIds.length) {
      throw new BadRequestException('راننده‌ای انتخاب نشده');
    }

    // تاریخ‌ها: اگر در بدنه باشد، همان؛ وگرنه از خود پروفایل
    const rawDates = (dto.dates?.length ? dto.dates : p.apply_dates) || [];
    const dates = uniqYmd(rawDates);
    if (!dates.length) {
      throw new BadRequestException('هیچ تاریخ معتبری برای اعمال داده نشده');
    }

    // ساعت‌ها و نوع شیفت
    if (!p?.type) throw new BadRequestException('نوع شیفت در پروفایل مشخص نیست');
    assertTimeRange(p.start_time, p.end_time);

    // وضعیت نهایی
    const baseStatus =
      dto.publish === true
        ? ShiftStatus.PUBLISHED
        : (p.status ?? ShiftStatus.DRAFT);

    // نرمال‌سازی فیلدهای اختیاری به null
    const vehicle_id = numOrNull(p.vehicle_id);
    const route_id = numOrNull(p.route_id);
    const station_start_id = numOrNull(p.station_start_id);
    const station_end_id = numOrNull(p.station_end_id);
    const note = p.note ?? null;

    // === تراکنش: اول پاک، بعد درج ===
    return this.ds.transaction(async (trx) => {
      const shiftRepo = trx.getRepository(Shift);

      // پاک‌سازی
      let deletedCount = 0;
      if (dto.wipe_first) {
        const scope = dto.wipe_scope === 'dates' ? 'dates' : 'all';
        if (scope === 'dates') {
          const r = await shiftRepo
            .createQueryBuilder()
            .delete()
            .from(Shift)
            .where('driver_id IN (:...driverIds)', { driverIds })
            .andWhere('date IN (:...dates)', { dates })
            .execute();
          deletedCount = Number(r?.affected ?? 0);
        } else {
          const r = await shiftRepo
            .createQueryBuilder()
            .delete()
            .from(Shift)
            .where('driver_id IN (:...driverIds)', { driverIds })
            .execute();
          deletedCount = Number(r?.affected ?? 0);
        }
      }

      // ساخت ردیف‌ها
      const rows: Partial<Shift>[] = [];
      for (const driver_id of driverIds) {
        for (const date of dates) {
          rows.push({
            driver_id,
            date,
            start_time: p.start_time,
            end_time: p.end_time,
            type: p.type,
            vehicle_id,
            route_id,
            station_start_id,
            station_end_id,
            note,
            status: baseStatus,
          });
        }
      }

      if (!rows.length) {
        return {
          ok: true,
          created: 0,
          deletedCount,
          drivers: driverIds.length,
          dates: dates.length,
          wiped: !!dto.wipe_first,
          scope: dto.wipe_scope ?? 'all',
          statusApplied: baseStatus,
        };
      }

      // درج chunk-ای (برای دیتاست‌های بزرگ)
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const batch = rows.slice(i, i + chunkSize);
        await shiftRepo
          .createQueryBuilder()
          .insert()
          .into(Shift)
          .values(batch)
          .execute();
      }

      return {
        ok: true,
        created: rows.length,
        deletedCount,
        drivers: driverIds.length,
        dates: dates.length,
        wiped: !!dto.wipe_first,
        scope: dto.wipe_scope ?? 'all',
        statusApplied: baseStatus,
      };
    });
  }
}

/* ================= Helpers ================= */

function isHHmm(s?: string) {
  return !!s && /^\d{2}:\d{2}$/.test(s) && +s.slice(0, 2) < 24 && +s.slice(3, 5) < 60;
}

function assertTimeRange(start: string, end: string) {
  if (!isHHmm(start) || !isHHmm(end)) {
    throw new BadRequestException('فرمت زمان نامعتبر است (HH:mm)');
  }
  if (end <= start) {
    // اگر شیفت شبانه (عبور از نیمه‌شب) داری، این شرط را تغییر بده
    throw new BadRequestException('ساعت پایان باید بعد از ساعت شروع باشد');
  }
}

function uniqYmd(arr: string[]) {
  return Array.from(
    new Set((arr || []).map(String).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))),
  ).sort((a, b) => a.localeCompare(b));
}

function numOrNull(v: any): number | null {
  return v === undefined || v === null || v === '' ? null : Number(v);
}

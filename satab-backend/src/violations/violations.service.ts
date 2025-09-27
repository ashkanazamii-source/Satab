// violations.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository, Between, FindOptionsWhere,
} from 'typeorm';
import { ViolationEntity } from './violation.entity';

type GeofenceExitMeta = Record<string, any>;
type OffRouteMeta = Record<string, any>;

@Injectable()
export class ViolationsService {
  constructor(
    @InjectRepository(ViolationEntity)
    private readonly repo: Repository<ViolationEntity>,
  ) { }

  /** ثبت تخلف خروج از ژئوفنس – شناسه‌ها عددی */
  async addGeofenceExit(input: {
    vehicleId: number;
    driverUserId?: number | null;
    meta: GeofenceExitMeta;
  }) {
    const row = this.repo.create({
      vehicle_id: input.vehicleId,
      driver_user_id: input.driverUserId ?? null,
      type: 'geofence_exit',
      meta: input.meta,
    });
    return this.repo.save(row);
  }

  /** ثبت تخلف خروج از مسیر – شناسه‌ها عددی */
  async addOffRoute(input: {
    vehicleId: number;
    driverUserId?: number | null;
    meta: OffRouteMeta;
  }) {
    const row = this.repo.create({
      vehicle_id: input.vehicleId,
      driver_user_id: input.driverUserId ?? null,
      type: 'off_route',
      meta: input.meta,
    });
    return this.repo.save(row);
  }

  // ---------- OFFSET PAGINATION ----------
  async findByVehicleOffset(
    vehicleId: number,
    limit = 50,
    page = 1,
    filters?: { type?: string; from?: Date; to?: Date },
  ) {
    const take = Math.max(1, Math.min(500, Number(limit) || 50));
    const skip = Math.max(0, (Number(page) - 1) * take);

    const where: FindOptionsWhere<ViolationEntity> = { vehicle_id: vehicleId };
    if (filters?.type) (where as any).type = filters.type;
    if (filters?.from || filters?.to) {
      const from = filters.from ?? new Date('1970-01-01T00:00:00Z');
      const to = filters.to ?? new Date();
      (where as any).created_at = Between(from, to);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC', id: 'DESC' as any },
      skip,
      take,
    });
    return { items, total, page: Number(page), limit: take, pageCount: Math.ceil(total / take) };
  }

  async latestOffset(limit = 50, page = 1, filters?: { type?: string; from?: Date; to?: Date }) {
    const take = Math.max(1, Math.min(500, Number(limit) || 50));
    const skip = Math.max(0, (Number(page) - 1) * take);

    const where: FindOptionsWhere<ViolationEntity> = {};
    if (filters?.type) (where as any).type = filters.type;
    if (filters?.from || filters?.to) {
      const from = filters.from ?? new Date('1970-01-01T00:00:00Z');
      const to = filters.to ?? new Date();
      (where as any).created_at = Between(from, to);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC', id: 'DESC' as any },
      skip,
      take,
    });
    return { items, total, page: Number(page), limit: take, pageCount: Math.ceil(total / take) };
  }

  // ---------- CURSOR PAGINATION ----------
  async findByVehicleCursor(opts: {
    vehicleId: number;
    limit?: number;
    before?: Date | string;
    beforeId?: number;
    after?: Date | string;
    afterId?: number;
    type?: string;
    from?: Date;
    to?: Date;
  }) {
    const take = Math.max(1, Math.min(500, Number(opts.limit) || 50));
    const qb = this.repo.createQueryBuilder('v')
      .where('v.vehicle_id = :vid', { vid: opts.vehicleId });

    if (opts.type) qb.andWhere('v.type = :type', { type: opts.type });
    if (opts.from) qb.andWhere('v.created_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: opts.to });

    if (opts.before) {
      const ba = new Date(opts.before);
      const bid = Number.isFinite(opts.beforeId) ? opts.beforeId! : Number.MAX_SAFE_INTEGER;
      qb.andWhere('(v.created_at < :ba OR (v.created_at = :ba AND v.id < :bid))', { ba, bid })
        .orderBy('v.created_at', 'DESC')
        .addOrderBy('v.id', 'DESC');
    } else if (opts.after) {
      const aa = new Date(opts.after);
      const aid = Number.isFinite(opts.afterId) ? opts.afterId! : -1;
      qb.andWhere('(v.created_at > :aa OR (v.created_at = :aa AND v.id > :aid))', { aa, aid })
        .orderBy('v.created_at', 'ASC')   // می‌گیریم و بعد برعکس می‌کنیم
        .addOrderBy('v.id', 'ASC');
    } else {
      qb.orderBy('v.created_at', 'DESC').addOrderBy('v.id', 'DESC');
    }

    qb.take(take);
    let items = await qb.getMany();
    if (opts.after) items = items.reverse();

    const nextCursor = items.length
      ? { before: items[items.length - 1].created_at, beforeId: items[items.length - 1].id }
      : null;
    const prevCursor = items.length
      ? { after: items[0].created_at, afterId: items[0].id }
      : null;

    return { items, limit: take, nextCursor, prevCursor };
  }

  async latestCursor(opts: {
    limit?: number;
    before?: Date | string;
    beforeId?: number;
    after?: Date | string;
    afterId?: number;
    type?: string;
    from?: Date;
    to?: Date;
  }) {
    const take = Math.max(1, Math.min(500, Number(opts.limit) || 50));
    const qb = this.repo.createQueryBuilder('v').where('1=1');

    if (opts.type) qb.andWhere('v.type = :type', { type: opts.type });
    if (opts.from) qb.andWhere('v.created_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: opts.to });

    if (opts.before) {
      const ba = new Date(opts.before);
      const bid = Number.isFinite(opts.beforeId) ? opts.beforeId! : Number.MAX_SAFE_INTEGER;
      qb.andWhere('(v.created_at < :ba OR (v.created_at = :ba AND v.id < :bid))', { ba, bid })
        .orderBy('v.created_at', 'DESC')
        .addOrderBy('v.id', 'DESC');
    } else if (opts.after) {
      const aa = new Date(opts.after);
      const aid = Number.isFinite(opts.afterId) ? opts.afterId! : -1;
      qb.andWhere('(v.created_at > :aa OR (v.created_at = :aa AND v.id > :aid))', { aa, aid })
        .orderBy('v.created_at', 'ASC')
        .addOrderBy('v.id', 'ASC');
    } else {
      qb.orderBy('v.created_at', 'DESC').addOrderBy('v.id', 'DESC');
    }

    qb.take(take);
    let items = await qb.getMany();
    if (opts.after) items = items.reverse();

    const nextCursor = items.length
      ? { before: items[items.length - 1].created_at, beforeId: items[items.length - 1].id }
      : null;
    const prevCursor = items.length
      ? { after: items[0].created_at, afterId: items[0].id }
      : null;

    return { items, limit: take, nextCursor, prevCursor };
  }
  // violations.service.ts

  async findByDriverCursor(opts: {
    driverId: number;
    limit: number;
    before?: string;
    beforeId?: number;
    after?: string;
    afterId?: number;
    type?: string;
    from?: Date;
    to?: Date;
  }) {
    const take = Math.max(1, Math.min(500, Number(opts.limit) || 50));
    const qb = this.repo.createQueryBuilder('v')
      .where('v.driver_user_id = :did', { did: opts.driverId });

    if (opts.type) qb.andWhere('v.type = :type', { type: opts.type });
    if (opts.from) qb.andWhere('v.created_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: opts.to });

    if (opts.before) {
      const ba = new Date(opts.before);
      const bid = Number.isFinite(opts.beforeId) ? opts.beforeId! : Number.MAX_SAFE_INTEGER;
      qb.andWhere('(v.created_at < :ba OR (v.created_at = :ba AND v.id < :bid))', { ba, bid })
        .orderBy('v.created_at', 'DESC')
        .addOrderBy('v.id', 'DESC');
    } else if (opts.after) {
      const aa = new Date(opts.after);
      const aid = Number.isFinite(opts.afterId) ? opts.afterId! : -1;
      qb.andWhere('(v.created_at > :aa OR (v.created_at = :aa AND v.id > :aid))', { aa, aid })
        .orderBy('v.created_at', 'ASC')
        .addOrderBy('v.id', 'ASC');
    } else {
      qb.orderBy('v.created_at', 'DESC').addOrderBy('v.id', 'DESC');
    }

    qb.take(take);
    let items = await qb.getMany();
    if (opts.after) items = items.reverse();

    const nextCursor = items.length
      ? { before: items[items.length - 1].created_at, beforeId: items[items.length - 1].id }
      : null;
    const prevCursor = items.length
      ? { after: items[0].created_at, afterId: items[0].id }
      : null;

    return { items, limit: take, nextCursor, prevCursor };
  }

  async findByDriverOffset(
    driverId: number,
    limit = 50,
    page = 1,
    filters?: { type?: string; from?: Date; to?: Date },
  ) {
    const take = Math.max(1, Math.min(500, Number(limit) || 50));
    const skip = Math.max(0, (Number(page) - 1) * take);

    const where: FindOptionsWhere<ViolationEntity> = { driver_user_id: driverId };
    if (filters?.type) (where as any).type = filters.type;
    if (filters?.from || filters?.to) {
      const from = filters.from ?? new Date('1970-01-01T00:00:00Z');
      const to = filters.to ?? new Date();
      (where as any).created_at = Between(from, to);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC', id: 'DESC' as any },
      skip,
      take,
    });
    return { items, total, page: Number(page), limit: take, pageCount: Math.ceil(total / take) };
  }

}

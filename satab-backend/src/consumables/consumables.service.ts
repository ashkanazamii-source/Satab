// consumables.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Consumable } from './consumable.entity';
import { CreateConsumableDto, UpdateConsumableDto } from '../dto/consumables.dto';

@Injectable()
export class ConsumablesService {
  constructor(
    @InjectRepository(Consumable) private readonly repo: Repository<Consumable>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private toNumber(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  private toDate(v: any): Date | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(+d) ? null : d;
  }

  private async withMaster<T>(fn: (m: ReturnType<DataSource['createEntityManager']>) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner('master');
    try {
      await qr.connect();
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  // ===== CRUD =====

  async list(vehicleId: number) {
    return this.withMaster(async (m) => {
      return m.getRepository(Consumable).find({
        where: { vehicle: { id: vehicleId } },
        order: { createdAt: 'DESC' },
      });
    });
  }

  async getOne(vehicleId: number, id: number) {
    return this.withMaster(async (m) => {
      const rows = await m.query(
        `
        SELECT
          c.id,
          c.vehicle_id        AS "vehicleId",
          c.mode              AS "mode",
          c.note              AS "note",
          c.start_at          AS "startAt",
          c.base_odometer_km  AS "baseOdometerKm",
          c.created_at        AS "createdAt"
        FROM consumables c
        WHERE c.id = $1 AND c.vehicle_id = $2
        `,
        [id, vehicleId],
      );
      const row = rows[0];
      if (!row) throw new NotFoundException('Consumable not found');
      return row;
    });
  }

  async create(vehicleId: number, dto: CreateConsumableDto) {
    if (dto.mode === 'time' && !dto.start_at) {
      throw new BadRequestException('start_at is required in time mode');
    }
    if (dto.mode === 'km' && dto.base_odometer_km == null) {
      throw new BadRequestException('base_odometer_km is required in km mode');
    }

    return this.withMaster(async (m) => {
      const r = m.getRepository(Consumable);

      const entity = r.create({
        vehicle: { id: vehicleId } as any,
        mode: dto.mode,
        note: dto.note ?? null,
        startAt: dto.mode === 'time' ? this.toDate(dto.start_at) : null,
        baseOdometerKm: dto.mode === 'km' ? this.toNumber(dto.base_odometer_km) : null,
      });

      const saved = await r.save(entity);

      const rows = await m.query(
        `
        SELECT
          c.id,
          c.vehicle_id        AS "vehicleId",
          c.mode              AS "mode",
          c.note              AS "note",
          c.start_at          AS "startAt",
          c.base_odometer_km  AS "baseOdometerKm",
          c.created_at        AS "createdAt"
        FROM consumables c
        WHERE c.id = $1
        `,
        [saved.id],
      );
      return rows[0];
    });
  }

  async update(vehicleId: number, id: number, dto: UpdateConsumableDto) {
    return this.withMaster(async (m) => {
      const r = m.getRepository(Consumable);
      const row = await r.findOne({ where: { id }, relations: ['vehicle'] });
      if (!row || (row as any).vehicle?.id !== vehicleId) {
        throw new NotFoundException('Consumable not found');
      }

      const nextMode = (dto.mode ?? row.mode) as 'km' | 'time';
      if (dto.note !== undefined) row.note = dto.note;

      if (nextMode === 'time') {
        if (dto.start_at !== undefined) row.startAt = this.toDate(dto.start_at);
        row.baseOdometerKm = null;
        if (!row.startAt) throw new BadRequestException('start_at is required in time mode');
      } else {
        if (dto.base_odometer_km !== undefined) {
          row.baseOdometerKm = this.toNumber(dto.base_odometer_km);
        }
        row.startAt = null;
        if (row.baseOdometerKm == null) {
          throw new BadRequestException('base_odometer_km is required in km mode');
        }
      }

      row.mode = nextMode;
      await r.save(row);
      // خواندن از مستر
      const rows = await m.query(
        `
        SELECT
          c.id,
          c.vehicle_id        AS "vehicleId",
          c.mode              AS "mode",
          c.note              AS "note",
          c.start_at          AS "startAt",
          c.base_odometer_km  AS "baseOdometerKm",
          c.created_at        AS "createdAt"
        FROM consumables c
        WHERE c.id = $1 AND c.vehicle_id = $2
        `,
        [id, vehicleId],
      );
      return rows[0];
    });
  }

  async remove(vehicleId: number, id: number) {
    return this.withMaster(async (m) => {
      const r = m.getRepository(Consumable);
      const row = await r.findOne({ where: { id }, relations: ['vehicle'] });
      if (!row || (row as any).vehicle?.id !== vehicleId) {
        throw new NotFoundException('Consumable not found');
      }
      await r.remove(row);
      return { success: true };
    });
  }
}

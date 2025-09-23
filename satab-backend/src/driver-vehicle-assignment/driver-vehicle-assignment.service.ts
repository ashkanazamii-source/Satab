import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

type StartOptions = { at?: Date }; // برای RFID: timestamp اختیاری
type EndOptions   = { at?: Date };

@Injectable()
export class DriverVehicleAssignmentService {
  constructor(
    @InjectRepository(DriverVehicleAssignment)
    private readonly repo: Repository<DriverVehicleAssignment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** شروع انتساب (اتمی + idempotent) */
  async startAssignment(driverId: number, vehicleId: number, opts: StartOptions = {}) {
    const at = opts.at ?? new Date();

    return this.dataSource.transaction(async (trx) => {
      const r = trx.getRepository(DriverVehicleAssignment);

      // اگر همین الآن انتساب بازِ همین راننده روی همین خودرو هست → همونو برگردون (idempotent)
      const existingSame = await r.findOne({
        where: { driver_id: driverId, vehicle_id: vehicleId, ended_at: IsNull() },
      });
      if (existingSame) return existingSame;

      // 1) بستن هر انتسابِ بازِ راننده
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: at })
        .where('driver_id = :driverId AND ended_at IS NULL', { driverId })
        .execute();

      // 2) بستن هر انتسابِ باز روی همین خودرو
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: at })
        .where('vehicle_id = :vehicleId AND ended_at IS NULL', { vehicleId })
        .execute();

      // 3) ایجاد رکورد جدید
      const assign = r.create({
        driver_id: driverId,
        vehicle_id: vehicleId,
        started_at: at,
      });
      return r.save(assign);
    });
  }

  /** پایان انتساب فعال راننده (اتمی) */
  async endAssignment(driverId: number, opts: EndOptions = {}) {
    const at = opts.at ?? new Date();

    return this.dataSource.transaction(async (trx) => {
      const r = trx.getRepository(DriverVehicleAssignment);

      const active = await r.findOne({ where: { driver_id: driverId, ended_at: IsNull() } });
      if (!active) return null;

      // تضمین ترتیب زمانی
      const endTime = at > active.started_at ? at : new Date(active.started_at.getTime() + 1000);

      active.ended_at = endTime;
      return r.save(active);
    });
  }

  /** گزارش امروزِ زیرمجموعه‌های SA (Postgres) */
  async listTodayForSuperAdmin(superAdminId: number, day = new Date()) {
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day);   end.setHours(23, 59, 59, 999);

    const rows = await this.dataSource.query(
      `
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE id = $1
        UNION ALL
        SELECT u.id FROM users u JOIN subordinates s ON u.parent_id = s.id
      )
      SELECT
        a.driver_id           AS "driverId",
        du.full_name          AS "driverName",
        a.vehicle_id          AS "vehicleId",
        v.plate_no            AS "vehiclePlate",
        a.started_at          AS "startAt",
        GREATEST(a.started_at, $2) AS "_effStart",
        LEAST(COALESCE(a.ended_at, NOW()), $3) AS "_effEnd",
        GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(a.ended_at, NOW()), $3)
                           - GREATEST(a.started_at, $2))))::int AS "durationSec"
      FROM driver_vehicle_assignments a
      JOIN users du   ON du.id = a.driver_id
      JOIN vehicles v ON v.id  = a.vehicle_id
      WHERE du.id IN (SELECT id FROM subordinates)
        AND a.started_at <= $3
        AND COALESCE(a.ended_at, NOW()) >= $2
      ORDER BY "driverName" ASC, a.started_at DESC;
      `,
      [superAdminId, start.toISOString(), end.toISOString()],
    );

    return rows.map((r: any) => ({
      driverId: r.driverId,
      driverName: r.driverName,
      vehicleId: r.vehicleId,
      vehiclePlate: r.vehiclePlate,
      startAt: r.startAt,
      durationSec: r.durationSec,
    }));
  }

  async getCurrentAssignment(driverId: number) {
    const assign = await this.repo.findOne({
      where: { driver_id: driverId, ended_at: IsNull() },
      relations: ['vehicle'],
    });
    return assign || null;
  }

  async history(driverId: number) {
    const list = await this.repo.find({
      where: { driver_id: driverId },
      order: { started_at: 'DESC' },
      relations: ['vehicle'],
    });
    return list;
  }

  // کمکی برای ثبت تخلف/پوزیشن: رانندهٔ فعالِ یک خودرو
  async getActiveDriverByVehicle(vehicleId: number): Promise<number | null> {
    const row = await this.repo.findOne({
      where: { vehicle_id: vehicleId, ended_at: IsNull() },
      select: ['driver_id'],
      order: { started_at: 'DESC' },
    });
    return row?.driver_id ?? null;
  }
}

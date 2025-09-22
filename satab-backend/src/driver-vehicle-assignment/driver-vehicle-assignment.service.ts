// src/driver-vehicle-assignment/driver-vehicle-assignment.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DriverVehicleAssignmentService {
  constructor(
    @InjectRepository(DriverVehicleAssignment)
    private readonly repo: Repository<DriverVehicleAssignment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) { }

  async startAssignment(driverId: number, vehicleId: number) {
    // 1) انتساب فعال قبلی همین راننده را ببند
    await this.repo.update({ driver_id: driverId, ended_at: IsNull() }, { ended_at: new Date() });
    // 2) هر انتساب فعال دیگری روی همین خودرو را ببند (برای جلوگیری از دو راننده روی یک خودرو)
    await this.repo.update({ vehicle_id: vehicleId, ended_at: IsNull() }, { ended_at: new Date() });

    // 3) انتساب جدید
    const assign = this.repo.create({
      driver_id: driverId,
      vehicle_id: vehicleId,
      started_at: new Date(),
    });
    return this.repo.save(assign);
  }
  async listTodayForSuperAdmin(superAdminId: number, day = new Date()) {
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);

    // ⚠️ Postgres
    const rows = await this.dataSource.query(
      `
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE id = $1       -- خود SA
        UNION ALL
        SELECT u.id FROM users u JOIN subordinates s ON u.parent_id = s.id
      )
      SELECT
        a.driver_id           AS "driverId",
        du.full_name          AS "driverName",
        a.vehicle_id          AS "vehicleId",
        v.plate_no            AS "vehiclePlate",
        a.started_at          AS "startAt",
        -- مدت کار «در همان روز»: از max(started_at, dayStart) تا min(ended_at|now, dayEnd)
        GREATEST(a.started_at, $2)                                   AS "_effStart",
        LEAST(COALESCE(a.ended_at, NOW()), $3)                       AS "_effEnd",
        GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(a.ended_at, NOW()), $3)
                           - GREATEST(a.started_at, $2))))::int      AS "durationSec"
      FROM driver_vehicle_assignments a
      JOIN users du   ON du.id = a.driver_id
      JOIN vehicles v ON v.id  = a.vehicle_id
      WHERE du.id IN (SELECT id FROM subordinates)
        AND a.started_at <= $3              -- تا قبل از پایان امروز شروع شده
        AND COALESCE(a.ended_at, NOW()) >= $2  -- و بعد از شروع امروز هنوز ادامه داشته
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

  async endAssignment(driverId: number) {
    const active = await this.repo.findOne({ where: { driver_id: driverId, ended_at: IsNull() } });
    if (!active) return null;
    active.ended_at = new Date();
    return this.repo.save(active);
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

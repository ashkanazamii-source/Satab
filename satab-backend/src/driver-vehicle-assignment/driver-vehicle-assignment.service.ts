import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Vehicle } from 'src/vehicles/vehicle.entity';
import { DriverRouteService } from 'src/drivers/driver-route.service';
type ToggleOptions = { at?: Date };
type StartOptions = { at?: Date }; // برای RFID: timestamp اختیاری
type EndOptions = { at?: Date };

@Injectable()
export class DriverVehicleAssignmentService {
  constructor(
    // ✅ دکوریتور روی همون پارامتر
    @InjectRepository(DriverVehicleAssignment)
    private readonly repo: Repository<DriverVehicleAssignment>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    // ✅ این هم نیاز به forFeature(Vehicle) در ماژول دارد
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,

    // ✅ اگر حلقهٔ وابستگی هست، forwardRef لازم است
    @Inject(forwardRef(() => DriverRouteService))
    private readonly driverRoutes: DriverRouteService,
  ) {}
  // driver-vehicle-assignment.service.ts
  // ✅ رانندهٔ منصوبِ یک خودرو در یک لحظهٔ مشخص (شامل بازه‌های بسته/باز)
  async getDriverByVehicleAt(vehicleId: number, at: Date): Promise<number | null> {
    const row = await this.repo.createQueryBuilder('a')
      .select(['a.driver_id'])
      .where('a.vehicle_id = :vid', { vid: vehicleId })
      .andWhere('a.started_at <= :at', { at })
      .andWhere('(a.ended_at IS NULL OR a.ended_at > :at)', { at })
      .orderBy('a.started_at', 'DESC')
      .getRawOne<{ a_driver_id: number }>();

    return row?.a_driver_id ?? null;
  }

  async toggleAssignment(
    driverId: number,
    vehicleId: number,
    opts: ToggleOptions = {},
  ) {
    const at = opts.at ?? new Date();

    // 1) اتمیک: تاگل انتساب داخل تراکنش
    const result = await this.dataSource.transaction(async (trx) => {
      const r = trx.getRepository(DriverVehicleAssignment);

      // 0) اگر همین زوج راننده-وسیله انتساب باز دارد → همان را ببند (toggle → end)
      const sameOpen = await r.findOne({
        where: { driver_id: driverId, vehicle_id: vehicleId, ended_at: IsNull() },
      });

      if (sameOpen) {
        const endTime = at > sameOpen.started_at
          ? at
          : new Date(sameOpen.started_at.getTime() + 1000);

        sameOpen.ended_at = endTime;
        const saved = await r.save(sameOpen);
        return { action: 'ended' as const, assignment: saved };
      }

      // 1) بستن هر انتساب باز راننده روی هر خودرویی
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: () => `GREATEST(started_at + interval '1 second', :at)` })
        .where('driver_id = :driverId AND ended_at IS NULL', { driverId })
        .setParameters({ at })
        .execute();

      // 2) بستن هر انتساب باز روی همین خودرو با هر راننده‌ای
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: () => `GREATEST(started_at + interval '1 second', :at)` })
        .where('vehicle_id = :vehicleId AND ended_at IS NULL', { vehicleId })
        .setParameters({ at })
        .execute();

      // 3) ایجاد انتساب جدید (toggle → start)
      const assign = r.create({
        driver_id: driverId,
        vehicle_id: vehicleId,
        started_at: at,
      });
      const saved = await r.save(assign);

      return { action: 'started' as const, assignment: saved };
    });

    // 2) Side-effects (خارج از تراکنش): Route راننده + اسنپ‌شات/بستن
    try {
      if (result.action === 'ended') {
        // اگر Route فعالی برای همین راننده روی همین خودرو باز است، با زمان end ببندش
        const active = await this.driverRoutes.getActiveRoute(driverId);
        if (active && active.vehicle_id === vehicleId) {
          const endAt = result.assignment.ended_at ?? at;
          await this.driverRoutes.finishRoute(active.id, { ended_at: endAt });
          (result as any).closed_route_id = active.id;
        }
      } else {
        // action === 'started'
        // هر Route بازی که برای راننده روی خودروی دیگری است، با همان "at" ببند
        const active = await this.driverRoutes.getActiveRoute(driverId);
        if (active && active.vehicle_id !== vehicleId) {
          await this.driverRoutes.finishRoute(active.id, { ended_at: at });
          (result as any).closed_route_id = active.id;
        }

        // Route جدید برای همین راننده/خودرو با started_at = at
        const newRoute = await this.driverRoutes.startRoute(driverId, vehicleId, {
          started_at: at,
        });

        // اسنپ‌شات وضعیت فعلی ماشین
        const v = await this.vehicleRepo.findOne({
          where: { id: vehicleId },
          select: [
            'id',
            'odometer_km',
            'ignition' as any,
            'engine_temp' as any,
            'last_location_lat' as any,
            'last_location_lng' as any,
            'last_location_ts' as any,
            'current_route_id' as any,
          ] as any,
        });

        // 2-الف) اگر لوکیشن آخر موجود است، به عنوان اولین نقطه در Route راننده ثبت کن
        if (v && (v as any).last_location_lat != null && (v as any).last_location_lng != null) {
          const rawTs = (v as any).last_location_ts ? new Date((v as any).last_location_ts) : null;
          // از آینده جلوتر نرو؛ یا زمان واقعی ≤ at یا خود at
          const seedTs = rawTs && rawTs <= at ? rawTs : at;

          await this.driverRoutes.addPoint(newRoute.id, {
            lat: (v as any).last_location_lat,
            lng: (v as any).last_location_lng,
            ts: seedTs.toISOString(),
          });

        }

        // 2-ب) متای تله‌متریِ لحظه شروع را نیز ذخیره کن (داخل بازه، دقیقاً at)
        await this.driverRoutes.addRouteMeta(newRoute.id, {
          ts: at.toISOString(),
          odometer: (v as any)?.odometer_km ?? null,
          ignition: (v as any)?.ignition ?? null,
          engine_temp: (v as any)?.engine_temp ?? null,
          vehicle_current_route_id: (v as any)?.current_route_id ?? null,
        });

        (result as any).route_id = newRoute.id;
      }
    } catch (e: any) {
      // خطای کارهای جانبی نباید تراکنش اصلی را fail کند
      console.warn('toggleAssignment side-effects failed:', e?.message || e);
    }

    return result;
  }


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
      // 1) بستن هر انتساب باز راننده
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: () => `GREATEST(started_at + interval '1 second', :at)` })
        .where('driver_id = :driverId AND ended_at IS NULL', { driverId })
        .setParameters({ at })
        .execute();

      // 2) بستن هر انتساب باز روی همین خودرو
      await r.createQueryBuilder()
        .update(DriverVehicleAssignment)
        .set({ ended_at: () => `GREATEST(started_at + interval '1 second', :at)` })
        .where('vehicle_id = :vehicleId AND ended_at IS NULL', { vehicleId })
        .setParameters({ at })
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
    const end = new Date(day); end.setHours(23, 59, 59, 999);

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

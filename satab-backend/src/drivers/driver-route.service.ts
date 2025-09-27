import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  FindManyOptions,
  In,
} from 'typeorm';
import { Users } from '../users/users.entity';
import { getDistance } from 'geolib';
import { DriverRoute, DriverRouteStatus } from './driver-route.entity';
import { DriverRouteGateway } from './driver-route.gateway'; // ✅ ایمپورت کردن Gateway

type PointInput = {
  lat: number;
  lng: number;
  ts?: string;        // alias کلاینت
  timestamp?: string; // alias دیگر
};
// ↑ بالای فایل (بعد از importها) اضافه کن:
type MonitorKey =
  | 'gps'
  | 'ignition'
  | 'idle_time'
  | 'odometer'
  | 'engine_temp'
  | 'geo_fence'
  | 'stations'
  | 'routes'
  | 'consumables';



const VALID_MONITOR_KEYS: ReadonlySet<MonitorKey> = new Set<MonitorKey>([
  'gps',
  'ignition',
  'idle_time',
  'odometer',
  'engine_temp',
  'geo_fence',
  'stations',
  'routes',
  'consumables',
]);

function sanitizeKeys(input: unknown): MonitorKey[] {
  const arr = Array.isArray(input) ? input : [];
  const out: MonitorKey[] = [];
  const seen = new Set<string>();
  for (const k of arr) {
    const s = (typeof k === 'string' ? k : '').trim().toLowerCase();
    if (s && VALID_MONITOR_KEYS.has(s as MonitorKey) && !seen.has(s)) {
      seen.add(s);
      out.push(s as MonitorKey);
    }
  }
  return out;
}


// ----- بالا، کنار importها
type TelemetryMsg = {
  ts?: string | number | Date;
  ignition?: boolean;
  idle_time?: number | string | null;
  odometer?: number | string | null;
  engine_on_duration?: number | string | null;
  distance_m?: number | string | null;
  mission_count?: number | string | null;
  lat?: number | string;
  lng?: number | string;
  [k: string]: any;
};





@Injectable()
export class DriverRouteService {
  dailyTrackRepo: any;
  dataSource: any;
  constructor(
    @InjectRepository(DriverRoute)
    private readonly routeRepo: Repository<DriverRoute>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    @Inject(forwardRef(() => DriverRouteGateway))
    private readonly gateway: DriverRouteGateway,
  ) { }

  /** محاسبه مسافت بر حسب کیلومتر */
  // جایگزین calculateDistance
  calculateDistance(points: { lat: any; lng: any; timestamp?: any }[]): number {
    if (!Array.isArray(points) || points.length < 2) return 0;

    // 1) نرمال‌سازی + سورت زمانی اگر timestamp داریم
    const norm = points
      .map(p => ({
        lat: Number((p as any).lat),
        lng: Number((p as any).lng),
        ts: (p as any).timestamp ? new Date((p as any).timestamp).getTime() : null
      }))
      .filter(p =>
        Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
        p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180 &&
        !(p.lat === 0 && p.lng === 0)
      );
    norm.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

    let total = 0;
    for (let i = 1; i < norm.length; i++) {
      const a = norm[i - 1], b = norm[i];
      const d = getDistance({ latitude: a.lat, longitude: a.lng }, { latitude: b.lat, longitude: b.lng });
      const dt = (a.ts != null && b.ts != null) ? Math.max(1, (b.ts - a.ts) / 1000) : null;

      // فیلتر نویز/پرش
      if (d < 3) continue;                       // کمتر از 3 متر بی‌اثر
      if (dt != null && d / dt > 60) continue;     // سرعت غیرواقعی
      if (dt == null && d > 1000) continue;      // پرش بزرگ بدون زمان

      total += d;
    }
    return total / 1000;
  }


  private num(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  private parseDate(v: any): Date | null {
    if (v instanceof Date && !isNaN(+v)) return v;
    if (typeof v === 'number') { const d = new Date(v); return isNaN(+d) ? null : d; }
    if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
    return null;
  }
  // راننده‌ی سوار روی این vehicle در لحظه‌ی at
  private async resolveDriverAt(vehicleId: number, at: Date): Promise<{ driverId: number, assignmentId: number | null } | null> {
    const rows = await this.userRepo.query(
      `
    SELECT id, driver_id
    FROM driver_vehicle_assignments
    WHERE vehicle_id = $1
      AND started_at <= $2
      AND (ended_at IS NULL OR ended_at > $2)
    ORDER BY started_at DESC
    LIMIT 1
    `,
      [vehicleId, at.toISOString()],
    );
    if (!rows?.length) return null;
    return { driverId: Number(rows[0].driver_id), assignmentId: Number(rows[0].id) || null };
  }

  // Route راننده که لحظه‌ی at را پوشش دهد (active یا خاتمه‌نیافته در آن لحظه)
  private async getRouteByDriverAt(driverId: number, at: Date) {
    return this.routeRepo.findOne({
      where: {
        driver_id: driverId,
        started_at: Between(new Date('1970-01-01T00:00:00Z'), at),
      } as any,
      order: { started_at: 'DESC' },
    }).then(r => (r && (!r.finished_at || r.finished_at > at) ? r : null));
  }

  // ساخت Route از لحظه‌ی at (وقتی راننده مسیر فعال ندارد اما تله‌متری داریم)
  private async createRouteAt(driverId: number, vehicleId: number | null, assignmentId: number | null, at: Date) {
    const dayBucket = at.toISOString().slice(0, 10);
    const driver = await this.userRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('راننده پیدا نشد');

    const route = this.routeRepo.create({
      driver,
      driver_id: driverId,
      vehicle_id: vehicleId ?? null,
      assignment_id: assignmentId ?? null,
      started_at: at,
      status: DriverRouteStatus.active,
      day_bucket: dayBucket,
      gps_points: [],
      telemetry_events: [],
      points_count: 0,
      total_distance_km: 0,
      last_lat: null,
      last_lng: null,
      last_point_ts: null,
    });
    return this.routeRepo.save(route);
  }
  /** تله‌متری تکیِ خودرو → میرور به راننده/Route مطابق زمان پیام */
  async ingestTelemetryForVehicle(vehicleId: number, msg: TelemetryMsg) {
    const at = this.parseDate(msg?.ts ?? new Date());
    if (!at) throw new BadRequestException('ts نامعتبر است.');

    // چه راننده‌ای سوار بوده؟
    const resolved = await this.resolveDriverAt(vehicleId, at);
    if (!resolved) return { ok: true, mirrored: false };

    const { driverId, assignmentId } = resolved;

    // Route پوشش‌دهنده‌ی این لحظه
    let route = await this.getRouteByDriverAt(driverId, at);
    if (!route) {
      // اگر راننده Route فعال در آن لحظه نداشت، برای پیوستگی داده‌ها یک Route بساز
      route = await this.createRouteAt(driverId, vehicleId ?? null, assignmentId, at);
    }

    // رویدادهای تله‌متری را به Route بچسبان
    await this.addRouteMeta(route.id, {
      ts: at.toISOString(),
      ignition: typeof msg.ignition === 'boolean' ? msg.ignition : undefined,
      idle_time: this.num(msg.idle_time) ?? undefined,
      odometer: this.num(msg.odometer) ?? undefined,
      engine_temp: this.num(msg.engine_temp) ?? undefined,
    });

    // اگر مختصات هم همراه پیام آمد، به عنوان نقطه‌ی مسیر ذخیره کن (افزایشی)
    const lat = this.num(msg.lat);
    const lng = this.num(msg.lng);
    if (lat != null && lng != null) {
      await this.addPoint(route.id, { lat, lng, ts: at.toISOString() });
    }

    return { ok: true, mirrored: true, driver_id: driverId, route_id: route.id };
  }

  /** تله‌متری Batchِ خودرو → میرور به راننده/Route */
  async ingestTelemetryBatchForVehicle(vehicleId: number, items: TelemetryMsg[]) {
    let mirrored = 0, skipped = 0;

    // برای کارایی بهتر، پیام‌ها را بر اساس ts صعودی مرتب کنیم
    const arr: TelemetryMsg[] = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => this.toEpochMs(a?.ts) - this.toEpochMs(b?.ts));

    // کش کوچک برای جلوگیری از ساخت Route‌های اضافی در یک بازه
    const routeCache = new Map<string, DriverRoute>(); // key: driverId@epochMinute

    for (const raw of arr) {
      const at = this.parseDate(raw?.ts ?? new Date());
      if (!at) { skipped++; continue; }

      const resolved = await this.resolveDriverAt(vehicleId, at);
      if (!resolved) { skipped++; continue; }
      const { driverId, assignmentId } = resolved;

      // Route در لحظه‌ی at
      let route = await this.getRouteByDriverAt(driverId, at);
      if (!route) {
        const key = `${driverId}@${Math.floor(at.getTime() / 60000)}`; // دقیقه‌ای
        route = routeCache.get(key) || await this.createRouteAt(driverId, vehicleId, assignmentId, at);
        routeCache.set(key, route);
      }

      await this.addRouteMeta(route.id, {
        ts: at.toISOString(),
        ignition: typeof raw.ignition === 'boolean' ? raw.ignition : undefined,
        idle_time: this.num(raw.idle_time) ?? undefined,
        odometer: this.num(raw.odometer) ?? undefined,
        engine_temp: this.num(raw.engine_temp) ?? undefined,
      });

      const lat = this.num(raw.lat);
      const lng = this.num(raw.lng);
      if (lat != null && lng != null) {
        await this.addPoint(route.id, { lat, lng, ts: at.toISOString() });
      }

      mirrored++;
    }

    return { ok: true, mirrored, skipped, total: arr.length };
  }

  private toEpochMs(v: any): number {
    const d = this.parseDate(v);
    return d ? d.getTime() : 0;
  }
  async addRouteMeta(
    routeId: number,
    meta: {
      ts: string;
      ignition?: boolean | null;
      idle_time?: number | null;
      odometer?: number | null;
      engine_temp?: number | null;
    },
  ) {
    // وجود و active بودن مسیر
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');
    if (route.status !== DriverRouteStatus.active) return route;

    // آبجکت رویداد
    const ev: Record<string, any> = { ts: meta.ts };
    if (meta.ignition !== undefined) ev.ignition = meta.ignition;
    if (meta.idle_time !== undefined) ev.idle_time = meta.idle_time;
    if (meta.odometer !== undefined) ev.odometer = meta.odometer;
    if (meta.engine_temp !== undefined) ev.engine_temp = meta.engine_temp;

    // تلاش برای آپدیت اتمی (PostgreSQL)
    try {
      const updated = await this.routeRepo.query(
        `
      UPDATE driver_routes
      SET telemetry_events = COALESCE(telemetry_events, '[]'::jsonb) || $1::jsonb
      WHERE id = $2 AND status = 'active'
      RETURNING *;
      `,
        [JSON.stringify([ev]), routeId],
      );
      if (updated?.[0]) {
        // برگشتن رکورد آپدیت شده (TypeORM plain → object)
        return this.routeRepo.create(updated[0]);
      }
    } catch {
      // اگر DB غیر Postgres بود یا کوئری خطا داد، fallback:
    }

    // fallback: read-modify-save
    const arr = Array.isArray((route as any).telemetry_events)
      ? (route as any).telemetry_events
      : [];
    (route as any).telemetry_events = [...arr, ev];
    return this.routeRepo.save(route);
  }



  /** مسیر فعالِ فعلی راننده (اگر باشد) */
  async getActiveRoute(driverId: number) {
    return this.routeRepo.findOne({
      where: { driver_id: driverId, status: DriverRouteStatus.active },
      order: { started_at: 'DESC' },
    });
  }

  /** شروع مسیر جدید */
  // DriverRouteService.startRoute (نسخهٔ درست)
  async startRoute(driverId: number, vehicleId?: number) {
    const driver = await this.userRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('راننده پیدا نشد');

    // بستن route فعال قبلی (اگر هست)
    const active = await this.getActiveRoute(driverId);
    if (active) {
      active.status = DriverRouteStatus.finished;
      active.finished_at = new Date();
      // چون در addPoint افزایشی می‌زنیم، همین مقدار کفایت می‌کند:
      // active.total_distance_km = this.calculateDistance(active.gps_points || []);
      await this.routeRepo.save(active);
    }

    // پیدا کردن vehicle/assignment از انتساب باز (اگر vehicleId پاس نشده)
    let vId = vehicleId ?? null;
    let assignmentId: number | null = null;
    if (vId == null) {
      const row = await this.userRepo.query(
        `
      SELECT id, vehicle_id
      FROM driver_vehicle_assignments
      WHERE driver_id = $1 AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
      `,
        [driverId],
      );
      if (row?.length) {
        assignmentId = Number(row[0].id);
        vId = row[0].vehicle_id != null ? Number(row[0].vehicle_id) : null;
      }
    }

    const now = new Date();
    const dayBucket = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const route = this.routeRepo.create({
      driver,
      driver_id: driver.id,
      status: DriverRouteStatus.active,
      vehicle_id: vId ?? null,
      assignment_id: assignmentId,
      started_at: now,
      day_bucket: dayBucket,
      // کش‌ها و داده‌های اولیه
      gps_points: [],
      points_count: 0,
      total_distance_km: 0,
      last_lat: null,
      last_lng: null,
      last_point_ts: null,
      telemetry_events: [], // اگر ستون را اضافه کرده‌ای
    });

    return this.routeRepo.save(route);
  }



  async addPoint(routeId: number, point: PointInput) {
    const lat = Number(point.lat), lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('مختصات نامعتبر است');
    }
    if (lat === 0 && lng === 0) return; // رد 0,0

    const ts = new Date(point.ts ?? point.timestamp ?? Date.now());
    if (isNaN(+ts)) throw new BadRequestException('ts نامعتبر است');

    const qr = this.routeRepo.manager.connection.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // قفل برای جلوگیری از race
      const route = await qr.manager
        .createQueryBuilder(DriverRoute, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: routeId })
        .getOne();

      if (!route) throw new NotFoundException('مسیر پیدا نشد');
      if (route.status !== DriverRouteStatus.active) throw new BadRequestException('این مسیر بسته شده است');

      // ترتیب زمانی: نقطهٔ out-of-order را فعلاً نادیده بگیر
      if (route.last_point_ts && ts.getTime() <= new Date(route.last_point_ts).getTime()) {
        await qr.rollbackTransaction();
        return route;
      }

      // محاسبهٔ افزایشی با فیلتر نویز/پرش
      let deltaM = 0;
      const lastLat = Number(route.last_lat);
      const lastLng = Number(route.last_lng);
      if (Number.isFinite(lastLat) && Number.isFinite(lastLng)) {
        const d = getDistance(
          { latitude: lastLat, longitude: lastLng },
          { latitude: lat, longitude: lng }, // ← فیکسِ latitude
        );
        const dt = route.last_point_ts ? (ts.getTime() - new Date(route.last_point_ts).getTime()) / 1000 : null;

        // فیلتر: <3m نویز، >60 m/s سرعت غیرواقعی، یا پرش >1000m بدون زمان
        const tooNoisy = d < 3;
        const tooFast = dt != null && d / dt > 60;
        const bigJump = dt == null && d > 1000;
        if (!tooNoisy && !tooFast && !bigJump) {
          deltaM = d;
        }
      }

      const newPoint = { lat, lng, timestamp: ts.toISOString() };

      // بهتر: فقط id را برگردانیم و بعد entity را بخوانیم تا تایپ درست باشد
      type Row = { id: number };
      const rows: Row[] = await qr.manager.query(
        `
      UPDATE driver_routes
      SET
        gps_points = COALESCE(gps_points, '[]'::jsonb) || $1::jsonb,
        points_count = COALESCE(points_count,0) + 1,
        total_distance_km = COALESCE(total_distance_km,0) + $2,
        last_lat = $3,
        last_lng = $4,
        last_point_ts = $5
      WHERE id = $6 AND status = 'active'
      RETURNING id;
      `,
        [JSON.stringify([newPoint]), deltaM / 1000, lat, lng, ts.toISOString(), routeId]
      );

      if (!rows?.length) {
        // هیچ ردیفی آپدیت نشد (مثلاً وضعیت active نبود) → رول‌بک کن و همین route را برگردان
        await qr.rollbackTransaction();
        return route;
      }

      await qr.commitTransaction();

      // داخل همان QueryRunner entity را بخوان تا تایپ دقیق DriverRoute داشته باشی
      const savedRoute = await qr.manager.findOne(DriverRoute, { where: { id: rows[0].id } });
      if (savedRoute) {
        this.gateway.broadcastLocationUpdate(savedRoute); // ← الان DriverRoute است، نه آرایه
        return savedRoute;
      }

      // فالس‌بک: اگر به هر دلیلی findOne چیزی نداد
      return await this.routeRepo.findOne({ where: { id: rows[0].id } });
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async processUnprocessedAssignments(): Promise<{ created_routes: number; processed_assignments: number; }> {
    console.log(`[PROCESS_PAST_DATA] Starting job to find and process unprocessed assignments...`);

    const unprocessedAssignments = await this.dataSource.query(`
        SELECT * FROM "driver_vehicle_assignments" AS dva
        WHERE dva.ended_at IS NOT NULL 
        AND NOT EXISTS (
            SELECT 1 
            FROM "driver_routes" AS dr 
            WHERE dr.assignment_id = dva.id
        )
    `);

    if (unprocessedAssignments.length === 0) {
      console.log(`[PROCESS_PAST_DATA] No unprocessed assignments found. All data is up to date.`);
      return { created_routes: 0, processed_assignments: 0 };
    }

    console.log(`[PROCESS_PAST_DATA] Found ${unprocessedAssignments.length} unprocessed assignment(s). Starting processing...`);

    const createdRoutes: DriverRoute[] = [];

    for (const assignment of unprocessedAssignments) {
      const started_at = new Date(assignment.started_at);
      const ended_at = new Date(assignment.ended_at);

      // ✅ ۱. پیدا کردن تمام تاریخ‌هایی که اساینمنت پوشش می‌دهد
      const datesToFetch = getDatesBetween(started_at, ended_at);
      if (datesToFetch.length === 0) continue;

      // ✅ ۲. دریافت ترک‌های روزانه برای تمام این تاریخ‌ها
      const vehicleTracks = await this.dailyTrackRepo.find({
        where: {
          vehicle_id: assignment.vehicle_id,
          track_date: In(datesToFetch),
        }
      });

      if (vehicleTracks.length === 0) {
        console.warn(`[PROCESS_PAST_DATA] Skipping assignment ID ${assignment.id}: No daily tracks found for vehicle ${assignment.vehicle_id} in date range ${datesToFetch.join(', ')}.`);
        continue;
      }

      // ✅ ۳. تجمیع تمام نقاط از تمام روزها
      const allVehiclePoints = vehicleTracks.flatMap(track => track.track_points || []);
      console.log(`[PROCESS_PAST_DATA]  - Processing assignment ID: ${assignment.id} for driver ID: ${assignment.driver_id}. Found ${allVehiclePoints.length} vehicle points across ${vehicleTracks.length} day(s).`);

      const startTime = started_at.getTime();
      const endTime = ended_at.getTime();

      const missionPoints = allVehiclePoints.filter(point => {
        const pointTime = new Date(point.timestamp).getTime();
        return pointTime >= startTime && pointTime <= endTime;
      });

      if (missionPoints.length === 0) {
        console.log(`[PROCESS_PAST_DATA]  - Skipping assignment ID ${assignment.id}: No points found in the exact time range.`);
        continue;
      }

      console.log(`[PROCESS_PAST_DATA]    - Filtered to ${missionPoints.length} points. Creating DriverRoute...`);

      const newDriverRoute = this.routeRepo.create({
        driver_id: assignment.driver_id,
        vehicle_id: assignment.vehicle_id,
        assignment_id: assignment.id,
        started_at,
        finished_at: ended_at,
        day_bucket: started_at.toISOString().slice(0, 10),
        status: DriverRouteStatus.finished,
        gps_points: missionPoints,
        points_count: missionPoints.length,
        total_distance_km: this.calculateDistance(missionPoints),
        last_lat: missionPoints[missionPoints.length - 1].lat,
        last_lng: missionPoints[missionPoints.length - 1].lng,
        last_point_ts: new Date(missionPoints[missionPoints.length - 1].timestamp),
      });

      const savedRoute = await this.routeRepo.save(newDriverRoute);
      createdRoutes.push(savedRoute);
    }

    console.log(`[PROCESS_PAST_DATA] Job finished. Processed ${unprocessedAssignments.length} assignments and created ${createdRoutes.length} new routes.`);
    return {
      created_routes: createdRoutes.length,
      processed_assignments: unprocessedAssignments.length,
    };
  }

  /** پایان مسیر */
  async finishRoute(routeId: number) {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');
    if (route.status === DriverRouteStatus.finished) return route;

    route.status = DriverRouteStatus.finished;
    route.finished_at = new Date();
    // اگر دوست داری دوباره exact محاسبه کنی، این خط رو آنکامنت کن:
    // route.total_distance_km = this.calculateDistance(route.gps_points || []);
    return this.routeRepo.save(route);
  }
  // داخل کلاس DriverRouteService

  /** تعداد مأموریت‌ها (Routeهای به پایان رسیده) برای یک راننده در بازه‌ی زمانی اختیاری */
  async getMissionCount(
    driverId: number,
    opts?: { from?: string | Date; to?: string | Date }
  ): Promise<{ driver_id: number; missions: number }> {
    const where: FindOptionsWhere<DriverRoute> = {
      driver_id: driverId,
      status: DriverRouteStatus.finished, // فقط پایان‌یافته‌ها = مأموریت
    };

    if (opts?.from || opts?.to) {
      const from = opts.from ? new Date(opts.from) : new Date('1970-01-01T00:00:00Z');
      const to = opts.to ? new Date(opts.to) : new Date();
      (where as any).started_at = Between(from, to);
    }

    const missions = await this.routeRepo.count({ where });
    return { driver_id: driverId, missions };
  }


  /** لیست مسیرهای راننده با فیلتر تاریخ/وضعیت + صفحه‌بندی */
  async getRoutesByDriver(
    driverId: number,
    opts?: {
      from?: string | Date;
      to?: string | Date;
      status?: DriverRouteStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const where: FindOptionsWhere<DriverRoute> = { driver_id: driverId };
    if (opts?.from || opts?.to) {
      const from = opts.from ? new Date(opts.from) : new Date('1970-01-01T00:00:00Z');
      const to = opts.to ? new Date(opts.to) : new Date();
      (where as any).started_at = Between(from, to);
    }
    if (opts?.status) (where as any).status = opts.status;

    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.max(1, Math.min(200, opts?.limit ?? 20));

    const options: FindManyOptions<DriverRoute> = {
      where,
      order: { started_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [items, total] = await this.routeRepo.findAndCount(options);
    return { items, total, page, limit };
  }

  /** آمار مسیرها در بازه‌ی زمانی */
  async getRoutesWithStats(
    driverId: number,
    opts?: { from?: string | Date; to?: string | Date },
  ) {
    const list = await this.getRoutesByDriver(driverId, {
      from: opts?.from,
      to: opts?.to,
      page: 1,
      limit: 10000, // برای آمار صفحه‌بندی لازم نیست
    });

    let totalDistance = 0;
    let totalWorkSeconds = 0;

    const trips = list.items.map((route) => {
      const distance = this.calculateDistance(route.gps_points || []);
      totalDistance += distance;

      const start = route.started_at ? new Date(route.started_at) : null;
      const end =
        route.status === DriverRouteStatus.finished && route.finished_at
          ? new Date(route.finished_at)
          : null;

      const workSeconds =
        start && end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)) : 0;
      totalWorkSeconds += workSeconds;

      const points = route.gps_points || [];
      return {
        id: route.id,
        started_at: route.started_at,
        finished_at: route.finished_at,
        finished: route.status === DriverRouteStatus.finished,
        distance_km: distance,
        work_seconds: workSeconds,
        start_point: points[0] || null,
        end_point: points[points.length - 1] || null,
        points,
      };
    });

    return {
      driver_id: driverId,
      total_trips: list.items.length,
      total_distance_km: totalDistance,
      total_work_seconds: totalWorkSeconds,
      trips,
    };
  }

  /** دریافت یک مسیر */
  async getOne(routeId: number, opts?: { includePoints?: boolean }) {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');

    if (opts?.includePoints === false) {
      const { gps_points, ...rest } = route as any;
      return rest;
    }
    return route;
  }

  /** راننده با والدها (برای کشف SA) */
  async getDriverWithParents(driverId: number): Promise<Users> {
    const driver = await this.userRepo.findOne({
      where: { id: driverId },
      relations: [
        'parent',
        'parent.parent',
        'parent.parent.parent',
        'parent.parent.parent.parent',
      ],
    });
    if (!driver) throw new NotFoundException('راننده پیدا نشد');
    return driver;
  }

  /** آخرین نقاط مسیر */
  async getLastPoints(routeId: number, n = 200) {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');
    const points = route.gps_points || [];
    return points.slice(-Math.max(1, n));
  }

  /* ===== Driver Options (Placeholder) =====
   * بعداً این دو متد را به منبع واقعی (جدول/سرویس policy) وصل کن */
  /** قابلیت‌های نمایشی راننده بر اساس سیاست‌های SA بالادستی و نوع خودروی فعلی */
  async getDriverOptions(driverId: number): Promise<MonitorKey[]> {
    // 1) پیدا کردن سوپرادمین بالادستی
    const driver = await this.getDriverWithParents(driverId); // از متد خود سرویس
    let cursor: Users | null = driver;
    let superAdminId: number | null = null;
    while (cursor?.parent) {
      if (cursor.parent.role_level === 2) {
        superAdminId = cursor.parent.id;
        break;
      }
      cursor = cursor.parent;
    }
    if (!superAdminId) {
      // SA پیدا نشد → یعنی سیاستی برای ارث بردن نداریم
      return [];
    }

    // 2) گرفتن assignment فعال راننده (اگر هست) → vehicle_id
    //   نکته: از raw query استفاده می‌کنیم تا نیاز به Repository جدید نداشته باشیم
    const rowsAssign = await this.userRepo.query(
      `SELECT vehicle_id
       FROM driver_vehicle_assignments
      WHERE driver_id = $1 AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1`,
      [driverId],
    );
    const vehicleId: number | null =
      rowsAssign?.length && rowsAssign[0]?.vehicle_id != null
        ? Number(rowsAssign[0].vehicle_id)
        : null;

    if (!vehicleId) {
      // راننده الان assigned نیست → فقط آمار خودش را می‌بیند
      return [];
    }

    // 3) نوع خودروی فعلی
    const rowsVeh = await this.userRepo.query(
      `SELECT vehicle_type_code
       FROM vehicles
      WHERE id = $1
      LIMIT 1`,
      [vehicleId],
    );
    const vehicleType: string | null =
      rowsVeh?.length && rowsVeh[0]?.vehicle_type_code
        ? String(rowsVeh[0].vehicle_type_code)
        : null;

    if (!vehicleType) {
      return [];
    }

    // 4) سیاست SA برای این نوع خودرو
    //    فرض جدول: vehicle_policies(owner_user_id, vehicle_type_code, is_allowed, monitor_params JSONB)
    const rowsPol = await this.userRepo.query(
      `SELECT monitor_params
       FROM vehicle_policies
      WHERE owner_user_id = $1
        AND vehicle_type_code = $2
        AND (is_allowed = TRUE OR is_allowed IS NULL)
      ORDER BY id DESC
      LIMIT 1`,
      [superAdminId, vehicleType],
    );

    if (!rowsPol?.length) {
      return [];
    }

    // monitor_params می‌تونه JSON یا رشته باشه → normalize
    let rawParams: unknown = rowsPol[0]?.monitor_params;
    try {
      if (typeof rawParams === 'string') {
        rawParams = JSON.parse(rawParams);
      }
    } catch {
      // اگر JSON نبود، رهایش کن → sanitizeKeys خودش هندل می‌کند
    }

    const keys = sanitizeKeys(rawParams);

    // 5) فقط نمایش (Read-only) — همینجا چیزی برای ویرایش برنمی‌گردونیم
    // اگر خواستی بعداً کلیدهایی مثل '*_edit' تعریف بشن، اینجا فیلترشون کن.

    return keys;
  }

  async driverHasOption(driverId: number, key: string): Promise<boolean> {
    let opts: string[] = [];
    try {
      const res = await this.getDriverOptions(driverId);
      if (Array.isArray(res)) opts = res;
    } catch (_) {
      // ignore
    }
    return opts.includes(key);
  }

}
function getDatesBetween(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDate.toISOString().slice(0, 10) + 'T00:00:00Z');
  const finalDate = new Date(endDate.toISOString().slice(0, 10) + 'T00:00:00Z');

  while (currentDate <= finalDate) {
    dates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}
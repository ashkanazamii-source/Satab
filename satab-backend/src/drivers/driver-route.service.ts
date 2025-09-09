import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  FindManyOptions,
} from 'typeorm';
import { Users } from '../users/users.entity';
import { getDistance } from 'geolib';
import { DriverRoute, DriverRouteStatus } from './driver-route.entity';

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

@Injectable()
export class DriverRouteService {
  constructor(
    @InjectRepository(DriverRoute)
    private readonly routeRepo: Repository<DriverRoute>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
  ) { }

  /** محاسبه مسافت بر حسب کیلومتر */
  calculateDistance(points: { lat: number; lng: number }[]): number {
    if (!points || points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += getDistance(
        { latitude: points[i - 1].lat, longitude: points[i - 1].lng },
        { latitude: points[i].lat, longitude: points[i].lng },
      );
    }
    return total / 1000;
  }

  /** مسیر فعالِ فعلی راننده (اگر باشد) */
  async getActiveRoute(driverId: number) {
    return this.routeRepo.findOne({
      where: { driver_id: driverId, status: DriverRouteStatus.active },
      order: { started_at: 'DESC' },
    });
  }

  /** شروع مسیر جدید */
  async startRoute(driverId: number, vehicleId?: number) {
    const driver = await this.userRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('راننده پیدا نشد');

    // بستن مسیر فعال قبلی
    const active = await this.getActiveRoute(driverId);
    if (active) {
      active.status = DriverRouteStatus.finished;
      active.finished_at = new Date();
      active.total_distance_km = this.calculateDistance(active.gps_points || []);
      await this.routeRepo.save(active);
    }

    const route = this.routeRepo.create({
      driver,
      driver_id: driver.id,
      gps_points: [],
      status: DriverRouteStatus.active,
      vehicle_id: vehicleId ?? null,
    });

    return this.routeRepo.save(route);
  }

  /** افزودن نقطه */
  async addPoint(routeId: number, point: PointInput) {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');
    if (route.status !== DriverRouteStatus.active) {
      throw new BadRequestException('این مسیر بسته شده است');
    }

    if (
      typeof point.lat !== 'number' ||
      typeof point.lng !== 'number' ||
      point.lat < -90 || point.lat > 90 ||
      point.lng < -180 || point.lng > 180
    ) {
      throw new BadRequestException('مختصات نامعتبر است');
    }

    const ts = point.ts ?? point.timestamp ?? new Date().toISOString();
    const p = { lat: point.lat, lng: point.lng, timestamp: ts };

    // مسافت افزایشی
    const pts = route.gps_points || [];
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const incMeters = getDistance(
        { latitude: last.lat, longitude: last.lng },
        { latitude: p.lat, longitude: p.lng },
      );
      route.total_distance_km = (route.total_distance_km || 0) + incMeters / 1000;
    }

    route.gps_points = [...pts, p];
    return this.routeRepo.save(route);
  }

  /** پایان مسیر */
  async finishRoute(routeId: number) {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('مسیر پیدا نشد');
    if (route.status === DriverRouteStatus.finished) return route;

    route.status = DriverRouteStatus.finished;
    route.finished_at = new Date();
    route.total_distance_km = this.calculateDistance(route.gps_points || []);
    return this.routeRepo.save(route);
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

import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/create-vehicle.dto';
import { normalizePlate } from '../dto/create-vehicle.dto';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';
import { VehicleDailyTrack, Coordinates } from './vehicle_daily_tracks.entity'; // ✅ هم Entity و هم Coordinates ایمپورت شده‌اند
import { VehiclesGateway } from './vehicles.gateway';
import { Between, In } from 'typeorm';
import { VehicleStation } from './vehicle-station.entity';
import { Route } from './route.entity';
import { RouteStation } from './route-station.entity';
import { VehiclePoliciesService } from '../vehicle-policies/vehicle-policies.service';
import { UserService } from '../users/users.service';
import { RouteGeofenceState } from './route-geofence-state.entity';
import { RouteGeofenceEvent } from './route-geofence-event.entity';
import { CreateRouteDto } from 'src/dto/create-route.dto';
import { DeepPartial } from 'typeorm';
import { ViolationsService } from '../violations/violations.service'; // ⬅️ اضافه
import { DriverVehicleAssignmentService } from '../driver-vehicle-assignment/driver-vehicle-assignment.service';
import { DriverRouteService } from 'src/drivers/driver-route.service';



type TelemetryRange = { from?: Date | string; to?: Date | string };

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function endOfToday() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}
function toDate(v?: Date | string) {
  if (!v) return undefined;
  const d = new Date(v); return isNaN(+d) ? undefined : d;
}

// جمع فاصله‌ی هورساین بین نقاط
function haversineSum(points: Array<{ lat: number; lng: number }>): number {
  const R = 6371; // km
  const toRad = (x: number) => x * Math.PI / 180;
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    d += 2 * R * Math.asin(Math.sqrt(h));
  }
  return +d.toFixed(2);
}



@Injectable()
export class VehiclesService {
  driverRoutesRepo: any;
  missionsRepo: any;
  trackRepo: any;
  tlmRepo: any;
  constructor(

    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
    @InjectRepository(VehicleDailyTrack)
    private readonly dailyTrackRepo: Repository<VehicleDailyTrack>,
    @InjectRepository(VehicleStation)
    private readonly stationRepo: Repository<VehicleStation>,
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    @InjectRepository(RouteStation)
    private readonly routeStationRepo: Repository<RouteStation>,
    @InjectRepository(VehiclePolicy)
    private readonly policyRepo: Repository<VehiclePolicy>,
    @InjectRepository(RouteGeofenceState)
    private readonly fenceStateRepo: Repository<RouteGeofenceState>,
    @InjectRepository(RouteGeofenceEvent)
    private readonly fenceEventRepo: Repository<RouteGeofenceEvent>,
    private readonly ds: DataSource,
    private readonly gw: VehiclesGateway,
    private readonly vehiclePolicies: VehiclePoliciesService,
    private readonly users: UserService,
    private readonly violations: ViolationsService,
    private readonly assignments: DriverVehicleAssignmentService,

    // ⚠️ forwardRef فقط روی خود پارامترِ سرویس
    @Inject(forwardRef(() => DriverRouteService))
    private readonly driverRoutes: DriverRouteService,
  ) { }


  private routeCache = new Map<number, { points: { lat: number; lng: number }[], threshold_m: number }>();
  private toMeters(latRef: number, lat: number, lng: number) {
    const mPerDegLat = 111_320;                 // ~
    const mPerDegLng = 111_320 * Math.cos(latRef * Math.PI / 180);
    return { x: lng * mPerDegLng, y: lat * mPerDegLat };
  }
  async getStationTerminals(vehicleId: number): Promise<{
    first: VehicleStation | null;
    last: VehicleStation | null;
    count: number;
  }> {
    const stations = await this.stationRepo.find({
      where: { vehicle_id: vehicleId },
      order: { id: 'ASC' },
      select: ['id', 'vehicle_id', 'owner_user_id', 'name', 'lat', 'lng', 'radius_m', 'created_at', 'updated_at'],
    });

    const count = stations.length;
    if (count === 0) return { first: null, last: null, count };
    if (count === 1) return { first: stations[0], last: stations[0], count };
    return { first: stations[0], last: stations[count - 1], count };
  }

  /** فاصله دوبعدی ساده (m)؛ برای near-check داخل شعاع ایستگاه */
  private haversineMeters(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
    const R = 6371000; // m
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** تشخیص اینکه نقطهٔ فعلی داخل کدام ترمینال است (اگر هیچ‌کدام، null) */
  async whichTerminalAtPoint(
    vehicleId: number,
    point: { lat: number; lng: number }
  ): Promise<('first' | 'last' | null)> {
    const { first, last } = await this.getStationTerminals(vehicleId);
    if (!first || !last) return null;

    const dFirst = this.haversineMeters(point, { lat: first.lat, lng: first.lng });
    const dLast = this.haversineMeters(point, { lat: last.lat, lng: last.lng });

    const insideFirst = dFirst <= (first.radius_m || 0);
    const insideLast = dLast <= (last.radius_m || 0);

    if (insideFirst && !insideLast) return 'first';
    if (insideLast && !insideFirst) return 'last';
    if (insideFirst && insideLast) return dFirst <= dLast ? 'first' : 'last';
    return null;
  }
  private distPointToSegmentMeters(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    // پروژه محلی روی صفحه (equirectangular around segment)
    const latRef = (a.lat + b.lat) / 2;
    const P = this.toMeters(latRef, p.lat, p.lng);
    const A = this.toMeters(latRef, a.lat, a.lng);
    const B = this.toMeters(latRef, b.lat, b.lng);

    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = P.x - A.x, APy = P.y - A.y;
    const ab2 = ABx * ABx + ABy * ABy || 1e-9;
    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));
    const Cx = A.x + t * ABx, Cy = A.y + t * ABy;
    const dx = P.x - Cx, dy = P.y - Cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private async loadRoutePolyline(routeId: number) {
    let cached = this.routeCache.get(routeId);
    if (cached) return cached;
    const r = await this.routeRepo.findOne({ where: { id: routeId }, select: ['id', 'threshold_m'] });
    if (!r) return null;
    const pts = await this.routeStationRepo.find({
      where: { route: { id: routeId } },
      order: { order_no: 'ASC', id: 'ASC' },
      select: ['lat', 'lng'],
    });
    if (pts.length < 2) return null;
    cached = { points: pts, threshold_m: Math.max(1, r.threshold_m || 60) };
    this.routeCache.set(routeId, cached);
    return cached;
  }

  private invalidateRouteCache(routeId: number) {
    this.routeCache.delete(routeId);
  }
  private minDistanceToRouteMeters(poly: { points: { lat: number; lng: number }[], threshold_m: number }, lat: number, lng: number) {
    let best = Number.POSITIVE_INFINITY;
    let bestIdx = -1;
    const p = { lat, lng };
    const pts = poly.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = this.distPointToSegmentMeters(p, pts[i], pts[i + 1]);
      if (d < best) { best = d; bestIdx = i; }
    }
    return { distance_m: best, segment_index: bestIdx, inside: best <= poly.threshold_m, threshold_m: poly.threshold_m };
  }


  // vehicles.service.ts
  async listStationsByVehicleForUser(vehicleId: number, _currentUserId: number) {
    // 👇 اگر می‌خواهی enforce شود:
    try {
      const allowed = await this.repo.createQueryBuilder('v')
        .leftJoin('v.owner_user', 'ou')
        .where('v.id = :vid', { vid: vehicleId })
        .andWhere('(ou.id = :uid OR v.responsible_user_id = :uid)', { uid: _currentUserId })
        .getOne();

      if (!allowed) throw new ForbiddenException('دسترسی به این وسیله مجاز نیست');
    } catch { /* اگر ACL جای دیگری enforce می‌شود، می‌توانی این را حذف کنی */ }

    return this.stationRepo.find({
      where: { vehicle_id: vehicleId },
      order: { id: 'ASC' },
    });
  }


  private async getUserRoleLevel(userId: number): Promise<number | null> {
    try {
      const r = await this.ds.query('select role_level from users where id = $1 limit 1', [userId]);
      return r?.[0]?.role_level ?? null;
    } catch {
      return null;
    }
  }

  private async canUserAddStations(userId: number): Promise<boolean> {
    // اگر جدول/Feature-Flag داری، اولویت با آن:
    try {
      const r = await this.ds.query(
        'select enabled from user_features where user_id = $1 and feature_key = $2 limit 1',
        [userId, 'stations:add']
      );
      if (r?.[0]?.enabled === true) return true;
      if (r?.[0]?.enabled === false) return false;
    } catch { /* ignore */ }

    // فالبک: نقش 1..5 مجاز
    const role = await this.getUserRoleLevel(userId);
    return role != null && role >= 1 && role <= 5;
  }

  // vehicles.service.ts (داخل کلاس VehiclesService)

  async createStation(
    vehicleId: number,
    currentUserId: number,
    dto: { name: string; lat: number; lng: number; radius_m?: number }
  ) {
    if (!(await this.canUserAddStations(currentUserId))) {
      throw new ForbiddenException('adding stations is not allowed');
    }

    // فقط owner_user_id لازم داریم
    const veh = await this.repo.findOne({
      where: { id: vehicleId },
      relations: { owner_user: true },
      select: { id: true, owner_user: { id: true } },
    });
    if (!veh) throw new NotFoundException('vehicle not found');

    const st = this.stationRepo.create({
      vehicle_id: vehicleId,
      owner_user_id: Number(veh.owner_user?.id),          // ✅ از رلیشن بگیر
      name: (dto.name ?? 'ایستگاه').trim(),
      lat: +dto.lat,
      lng: +dto.lng,
      radius_m: dto.radius_m && dto.radius_m > 0 ? Math.min(+dto.radius_m, 5000) : 100,
    });

    const saved = await this.stationRepo.save(st);
    this.gw.emitStationsChanged(vehicleId, Number(veh.owner_user?.id), { type: 'created', station: saved });
    return saved;
  }

  // vehicles.service.ts
  async getAiMonitor(vehicleId: number) {
    const defaults = await this.getEffectiveOptions(vehicleId).catch(() => []);
    return { enabled: true, params: defaults }; // موقت
  }

  async setAiMonitor(
    vehicleId: number,
    body: { enabled?: boolean; params?: string[] },
  ) {
    // TODO: بعداً پرسیستنس بده
    return this.getAiMonitor(vehicleId);
  }


  async updateStation(stationId: number, ownerUserId: number, dto: Partial<{ name: string; lat: number; lng: number; radius_m: number }>) {
    const st = await this.stationRepo.findOne({ where: { id: stationId, owner_user_id: ownerUserId } });
    if (!st) throw new NotFoundException('ایستگاه یافت نشد'); // یا اجازه‌نداری
    Object.assign(st, dto);
    const saved = await this.stationRepo.save(st);
    this.gw.emitStationsChanged(st.vehicle_id, ownerUserId, { type: 'updated', station: saved });
    return saved;
  }

  async deleteStation(stationId: number, ownerUserId: number) {
    const st = await this.stationRepo.findOne({ where: { id: stationId, owner_user_id: ownerUserId } });
    if (!st) throw new NotFoundException('ایستگاه یافت نشد');
    await this.stationRepo.delete(stationId);
    this.gw.emitStationsChanged(st.vehicle_id, ownerUserId, { type: 'deleted', station_id: stationId });
    return { ok: true };
  }

  async ingestVehicleTelemetry(
    vehicleId: number,
    data: { ignition?: boolean; idle_time?: number; odometer?: number; engine_temp?: number; ts?: string }
  ) {
    const ts = data.ts ? new Date(data.ts) : new Date();

    // 1) آپدیت خودِ Vehicle
    if (data.ignition !== undefined) {
      await this.applyIgnitionAccum(vehicleId, data.ignition, ts);
      this.gw.emitIgnition(vehicleId, data.ignition, ts.toISOString());
    }

    const patch: any = {};
    if (data.idle_time !== undefined) {
      patch.idle_time_sec = data.idle_time;
      this.gw.emitIdle(vehicleId, data.idle_time, ts.toISOString());
    }
    if (data.odometer !== undefined) {
      patch.odometer_km = data.odometer;
      this.gw.emitOdometer(vehicleId, data.odometer, ts.toISOString());
    }
    if (data.engine_temp !== undefined) {
      // اگر ستون engine_temp در Vehicle داری، ذخیره‌اش کن
      patch.engine_temp = data.engine_temp;
    }
    if (Object.keys(patch).length) {
      await this.repo.update({ id: vehicleId }, patch);
    }

    // 2) نسبت دادن به راننده در همان لحظه
    const driverId = await this.assignments.getDriverByVehicleAt(vehicleId, ts);
    if (!driverId) return; // در آن لحظه راننده‌ای روی این خودرو نبوده

    const activeRoute = await this.driverRoutes.getActiveRoute(driverId);

    // فقط اگر route فعال هست و به همین vehicle وصله، متای تله‌متری را روی route ذخیره کن
    if (activeRoute && activeRoute.vehicle_id === vehicleId) {
      await this.driverRoutes.addRouteMeta(activeRoute.id, {
        ts: ts.toISOString(),
        ignition: data.ignition ?? null,
        idle_time: data.idle_time ?? null,
        odometer: data.odometer ?? null,
        engine_temp: data.engine_temp ?? null,
      });

      // نوتیفای سمت راننده (اختیاری)
      (this.gw as any)?.server?.to(`user:${driverId}`)?.emit('driver:telemetry', {
        route_id: activeRoute.id,
        vehicle_id: vehicleId,
        ts: ts.toISOString(),
        ignition: data.ignition ?? null,
        idle_time: data.idle_time ?? null,
        odometer: data.odometer ?? null,
        engine_temp: data.engine_temp ?? null,
      });

    } else {
      // این‌جا یا route فعالی نیست، یا route فعال برای vehicle دیگری است.
      // بسته به بیزنس:
      // - می‌توانی هیچ کاری نکنی، یا
      // - خودکار یک route جدید با همین vehicle بسازی (اگر نمی‌خواهی، این بخش را کامنت بگذار).
      // const newRoute = await this.driverRoutes.startRoute(driverId, vehicleId);
      // await this.driverRoutes.addRouteMeta(newRoute.id, {
      //   ts: ts.toISOString(),
      //   ignition: data.ignition ?? null,
      //   idle_time: data.idle_time ?? null,
      //   odometer: data.odometer ?? null,
      //   engine_temp: data.engine_temp ?? null,
      // });
    }
  }



  async readVehicleTelemetry(
    vehicleId: number,
    keys: string[] = [],
    range?: TelemetryRange,   // ⬅️ بازه اختیاری
  ) {
    const out: any = {};

    // وسیله و سیاست
    const v = await this.repo.findOne({
      where: { id: vehicleId },
      relations: { owner_user: true },
      select: {
        id: true,
        vehicle_type_code: true,
        owner_user: { id: true },
        // اگر این فیلدها روی جدول vehicle داری و می‌خوای مستقیم هم بدهی:
        ignition: true as any,
        idletime_sec: false as any,    // فقط برای تایپ‌هینت
        odometer_km: true as any,
        ignition_on_sec_since_reset: true as any,
      } as any,
    });
    if (!v) throw new NotFoundException('Vehicle not found');

    // اگر لازم داری:
    // const pol = await this.policyRepo.findOne({
    //   where: { user_id: Number(v.owner_user?.id), vehicle_type_code: v.vehicle_type_code },
    // });

    const want = (k: string) => !keys.length || keys.includes(k);

    // پایه‌ها (آخرین وضعیت ذخیره‌شده روی رکورد vehicle)
    if (want('ignition')) out.ignition = (v as any).ignition ?? null;
    if (want('idle_time')) out.idle_time = (v as any).idletime_sec ?? (v as any).idle_time_sec ?? null;
    if (want('odometer')) out.odometer = (v as any).odometer_km ?? null;
    if (want('engine_on_duration')) out.engine_on_duration = (v as any).ignition_on_sec_since_reset ?? 0;

    // بازه‌ی زمانی
    const from = toDate(range?.from) ?? startOfToday();
    const to = toDate(range?.to) ?? endOfToday();

    // --- distance_km: اول اختلاف کیلومترشمار، فالبک = جمع GPS ---
    if (want('distance_km')) {
      let dist: number | null = null;

      // اگر جدول/ریپوی تله‌متری داری که تاریخچهٔ کیلومترشمار را نگه می‌دارد:
      try {
        if (this.tlmRepo?.nearestNumber) {
          const odoStart = await this.tlmRepo.nearestNumber(vehicleId, 'odometer', from, 'lte');
          const odoEnd = await this.tlmRepo.nearestNumber(vehicleId, 'odometer', to, 'lte');
          if (odoStart != null && odoEnd != null) {
            const d = odoEnd - odoStart;
            if (Number.isFinite(d) && d >= 0) dist = +d.toFixed(2);
          }
        }
      } catch { /* ignore */ }

      // فالبک: از نقاط GPS بازه جمع بزن
      if (dist == null) {
        try {
          if (this.trackRepo?.getPoints) {
            const pts = await this.trackRepo.getPoints(vehicleId, from, to); // [{lat,lng,ts}, ...]
            const arr = Array.isArray(pts) ? pts.map(p => ({ lat: +p.lat, lng: +p.lng })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)) : [];
            dist = arr.length >= 2 ? haversineSum(arr) : 0;
          }
        } catch { /* ignore */ }
      }

      out.distance_km = dist ?? null;
    }

    // --- jobs_count: تعداد مأموریت‌های این ماشین در بازه ---
    if (want('jobs_count')) {
      let cnt: number | null = null;
      try {
        if (this.missionsRepo?.countByVehicle) {
          cnt = await this.missionsRepo.countByVehicle(vehicleId, from, to);
        } else if (this.driverRoutesRepo?.countByVehicleFinished) {
          // اگر مأموریت‌ها را در driver_routes نگه می‌داری:
          cnt = await this.driverRoutesRepo.countByVehicleFinished(vehicleId, from, to);
        }
      } catch { /* ignore */ }
      out.jobs_count = cnt ?? null;
    }

    return out;
  }


  // vehicles.service.ts
  async updateVehicleStation(vehicleId: number, id: number, dto: { name?: string; radius_m?: number; lat?: number; lng?: number }) {
    const st = await this.stationRepo.findOne({ where: { id, vehicle_id: vehicleId } });
    if (!st) throw new NotFoundException('station not found');

    if (dto.name !== undefined) st.name = dto.name;
    if (dto.radius_m !== undefined) st.radius_m = dto.radius_m;
    if (dto.lat !== undefined) st.lat = dto.lat;
    if (dto.lng !== undefined) st.lng = dto.lng;

    const saved = await this.stationRepo.save(st);

    // ✅ برادکست درست، با owner_user_id خود ایستگاه
    this.gw.emitStationsChanged(saved.vehicle_id, saved.owner_user_id, { type: 'updated', station: saved });
    return saved;
  }

  async deleteVehicleStation(vehicleId: number, id: number, actorUserId?: number) {
    if (actorUserId != null) {
      const allowed = await this.repo.createQueryBuilder('v')
        .leftJoin('v.owner_user', 'ou')
        .where('v.id = :vid', { vid: vehicleId })
        .andWhere('(ou.id IN (:...oids) OR v.responsible_user_id = :me)', {
          oids: await this.getAllowedOwnerIds(actorUserId),
          me: actorUserId,
        })
        .getOne();

      if (!allowed) throw new NotFoundException('vehicle not found or not accessible');
    }

    const st = await this.stationRepo.findOne({ where: { id, vehicle_id: vehicleId } });
    if (!st) throw new NotFoundException('station not found');

    await this.stationRepo.delete(id);
    this.gw.emitStationsChanged(st.vehicle_id, st.owner_user_id, { type: 'deleted', station_id: id });
  }







  private async applyIgnitionAccum(vehicleId: number, nextIgn: boolean, at: Date) {
    const v = await this.repo.findOne({
      where: { id: vehicleId },
      select: ['id', 'ignition', 'last_ignition_change_at', 'ignition_on_sec_since_reset']
    });
    if (!v) return;

    let inc = 0;
    if (v.ignition === true && v.last_ignition_change_at) {
      inc = Math.max(0, Math.floor((at.getTime() - new Date(v.last_ignition_change_at).getTime()) / 1000));
    }

    await this.repo.update({ id: vehicleId }, {
      ignition: nextIgn,
      last_ignition_change_at: at,
      ignition_on_sec_since_reset: (v.ignition_on_sec_since_reset || 0) + inc,
    } as any);
  }





  // متد کمکی برای تبدیل تاریخ
  private toDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }



  async ingestVehiclePos(vehicleId: number, lat: number, lng: number, ts?: string) {
    const when = ts ? new Date(ts) : new Date();

    // لاگ ورودی
    console.log(`\n--- [START] Received point for Vehicle ID: ${vehicleId} at ${when.toISOString()}`);

    // بخش ذخیره در آرشیو خودرو (این بخش را تغییر ندهید)
    const trackDate = this.toDateString(when);
    let dailyTrack = await this.dailyTrackRepo.findOneBy({ vehicle_id: vehicleId, track_date: trackDate });
    const newPoint: Coordinates = { lat, lng };
    if (dailyTrack) {
      dailyTrack.track_points.push(newPoint);
    } else {
      dailyTrack = this.dailyTrackRepo.create({ vehicle_id: vehicleId, track_date: trackDate, track_points: [newPoint] });
    }
    await this.dailyTrackRepo.save(dailyTrack);
    await this.repo.update({ id: vehicleId }, { last_location_lat: lat, last_location_lng: lng, last_location_ts: when });
    this.gw.emitVehiclePos(vehicleId, lat, lng, when.toISOString());


    // --- بخش عیب‌یابی ---
    console.log(`LOG 1: Checking for assigned driver at timestamp: ${when.toISOString()}`);
    const driverId = await this.assignments.getDriverByVehicleAt(vehicleId, when);

    if (!driverId) {
      console.error(`LOG 2: FAILED - No driver was found for this vehicle at this time.`);
      console.log("--- [END] Finished processing point (no driver assignment found). ---");
      return;
    }

    console.log(`LOG 3: SUCCESS - Found Driver ID: ${driverId}. Checking for their active route...`);
    let activeRoute = await this.driverRoutes.getActiveRoute(driverId);

    if (activeRoute && activeRoute.vehicle_id !== vehicleId) {
      console.log(`LOG 3.5: Found active route ${activeRoute.id}, but it belongs to another vehicle. Finishing it.`);
      await this.driverRoutes.finishRoute(activeRoute.id);
      activeRoute = null;
    }

    if (activeRoute) {
      console.log(`LOG 4: Active route found (ID: ${activeRoute.id}). Adding point to existing route.`);
      await this.driverRoutes.addPoint(activeRoute.id, { lat, lng, ts: when.toISOString() });
    } else {
      console.log(`LOG 5: No active route found. Creating a new one for driver ${driverId}...`);
      const newRoute = await this.driverRoutes.startRoute(driverId, vehicleId);
      console.log(`LOG 6: New route created (ID: ${newRoute.id}). Adding the first point.`);
      await this.driverRoutes.addPoint(newRoute.id, { lat, lng, ts: when.toISOString() });
    }
    await this.checkRouteGeofence(vehicleId, lat, lng, when);

    console.log("--- [END] Finished processing driver logic successfully. ---");
  }
  // vehicles.service.ts
  async handleGeofenceExit(vehicleId: number, lat: number, lng: number, when: Date) {
    // بهتر: راننده در همان زمانِ رویداد
    const driverUserId =
      (this.assignments.getDriverByVehicleAt
        ? await this.assignments.getDriverByVehicleAt(vehicleId, when)
        : await this.assignments.getActiveDriverByVehicle(vehicleId));

    await this.violations.addGeofenceExit({
      vehicleId,
      driverUserId,
      meta: { lat, lng, at: when.toISOString() },
    });

    this.gw.emitGeofenceViolation(vehicleId, {
      vehicleId, lat, lng, ts: when.toISOString(),
    });
  }



  async getVehicleTrack(vehicleId: number, from: Date, to: Date): Promise<VehicleDailyTrack[]> {
    const fromDate = this.toDateString(from);
    const toDate = this.toDateString(to);

    return this.dailyTrackRepo.find({
      where: {
        vehicle_id: vehicleId,
        track_date: Between(fromDate, toDate),
      },
      order: {
        track_date: 'ASC',
      },
    });
  }

  async create(dto: CreateVehicleDto) {
    // نام اجباری
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('نام ماشین الزامی است.');
    }

    // IMEI اختیاری: فقط اگر داده شد چک یکتا
    if (dto.tracker_imei && dto.tracker_imei.trim()) {
      dto.tracker_imei = dto.tracker_imei.trim().replace(/\s/g, '').toUpperCase();
      const dup = await this.repo.findOne({ where: { tracker_imei: dto.tracker_imei } });
      if (dup) throw new BadRequestException('این UID/IMEI قبلاً ثبت شده است.');
    } else {
      dto.tracker_imei = null as any;
    }
    let respRel: any = null;
    if ((dto as any).responsible_user_id != null) {
      const rid = Number((dto as any).responsible_user_id);
      if (!Number.isFinite(rid)) {
        throw new BadRequestException('responsible_user_id نامعتبر است.');
      }
      const row = await this.ds.query('select id from users where id = $1 limit 1', [rid]);
      if (!row?.[0]) throw new BadRequestException('کاربر مسئول یافت نشد');
      respRel = { id: rid };
    }

    // 1) کشور مجاز؟
    const allowed = await this.ds.getRepository('user_allowed_countries')
      .createQueryBuilder('c')
      .select('c.country_code', 'country_code')
      .where('c.user_id = :uid', { uid: dto.owner_user_id })
      .getRawMany();
    const allowedSet = new Set(allowed.map((r: any) => r.country_code));
    if (!allowedSet.has(dto.country_code)) {
      throw new BadRequestException('کشور انتخاب‌شده برای این کاربر مجاز نیست.');
    }

    // 2) سقف نوع خودرو
    const vpRows = await this.ds.getRepository('vehicle_policies')
      .createQueryBuilder('p')
      .where('p.user_id = :uid AND p.vehicle_type_code = :t', {
        uid: dto.owner_user_id, t: dto.vehicle_type_code
      })
      .getMany();
    const policy: any = vpRows[0];
    if (!policy || !policy.is_allowed) {
      throw new BadRequestException('این نوع خودرو برای شما مجاز نیست.');
    }

    const usedCount = await this.repo.count({
      where: { owner_user: { id: dto.owner_user_id }, vehicle_type_code: dto.vehicle_type_code as any },
    });
    if (usedCount >= (policy.max_count || 0)) {
      throw new BadRequestException('سهمیه این نوع خودرو تمام شده است.');
    }

    // 3) ولیدیشن پلاک
    if (!isPlateValidForCountry(dto.country_code, dto.plate_no)) {
      throw new BadRequestException('فرمت پلاک با کشور انتخاب‌شده سازگار نیست.');
    }

    // 4) ذخیره
    try {
      const v = this.repo.create({
        ...dto,
        owner_user: { id: dto.owner_user_id } as any,
        responsible_user: respRel,
        name: dto.name.trim(),
      });
      (v as any).plate_norm = normalizePlate(dto.plate_no);
      return await this.repo.save(v);
    } catch (e: any) {
      if (e.code === '23505') {
        throw new BadRequestException('این پلاک در این کشور قبلاً ثبت شده است.');
      }
      throw e;
    }
  }


  private async getPerVehicleOptions(vehicleId: number): Promise<string[] | null> {
    // اگه جدول/فیلدی برای آپشن اختصاصی هر ماشین داری، اینجا بخون
    return null;
  }
  async getEffectiveOptions(vehicleId: number): Promise<string[]> {
    const v = await this.repo.findOne({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException('Vehicle not found');

    // 1) per-vehicle (در صورت وجود)
    const perVehicle = await this.getPerVehicleOptions(vehicleId);
    if (perVehicle && perVehicle.length) return perVehicle;

    // 2) از پالیسی صاحب ماشین
    const pol = await this.policyRepo.findOne({
      where: { user_id: v.owner_user_id, vehicle_type_code: v.vehicle_type_code },
    });

    if (!pol || !pol.is_allowed) return [];
    return Array.isArray(pol.monitor_params) ? pol.monitor_params : [];
  }
  private async isVehicleVisibleTo(userId: number, vehicleId: number): Promise<boolean> {
    // مسئول همان ماشین + مالک/زیرمجموعه مثل قبل
    const row = await this.repo.createQueryBuilder('v')
      .leftJoin('v.owner_user', 'ou')
      .where('v.id = :vid', { vid: vehicleId })
      .andWhere('(ou.id = :uid OR v.responsible_user_id = :uid)', { uid: userId })
      .getOne();
    return !!row;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('وسیله یافت نشد');

    // ✅ نرمال‌سازی IMEI و چک یکتا (مثل قبل)
    if (dto.tracker_imei) {
      const imei = dto.tracker_imei.trim().toUpperCase();
      const dup = await this.repo.findOne({ where: { tracker_imei: imei, id: Not(id) } });
      if (dup) throw new BadRequestException('این UID/IMEI قبلاً ثبت شده است.');
      v.tracker_imei = imei;
    }

    // ✅ ست/حذف مسئول ماشین
    if ('responsible_user_id' in dto) {
      const rid = dto.responsible_user_id ?? null;

      if (rid !== null) {
        const row = await this.ds.query('select id from users where id = $1 limit 1', [rid]);
        if (!row?.[0]) throw new BadRequestException('کاربر مسئول یافت نشد');
      }

      // روی رابطه ست کن
      (v as any).responsible_user = rid ? ({ id: rid } as any) : null;

      // جلوی assign مستقیم فیلد ID از dto را بگیر
      delete (dto as any).responsible_user_id;
    }

    // سایر فیلدها
    Object.assign(v, dto);

    try {
      return await this.repo.save(v);
    } catch (e: any) {
      if (e.code === '23505' && e.constraint === 'uq_vehicle_tracker_imei') {
        throw new BadRequestException('این UID/IMEI قبلاً ثبت شده است.');
      }
      throw e;
    }
  }


  // vehicles.service.ts
  async findOne(id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('وسیله یافت نشد');

    const stations = await this.stationRepo.find({
      where: { vehicle_id: id },
      order: { id: 'ASC' },
    });

    // همون ماشین + ایستگاه‌ها
    return { ...v, stations };
  }


  async remove(id: number) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('وسیله یافت نشد');
    await this.repo.remove(v);
    return { ok: true };
  }

  async findByPlate(country_code: string, plateInput: string) {
    const norm = normalizePlate(plateInput);
    return this.repo.findOne({ where: { country_code: country_code as any, plate_norm: norm } });
  }

  // گرفتن زیرمجموعه‌ی کامل کاربران (برای فیلترسازی درختی)
  private async getSubtreeUserIds(rootUserId: number): Promise<number[]> {
    const rows = await this.ds.query(`
      WITH RECURSIVE sub AS (
        SELECT id, parent_id FROM users WHERE id = $1
        UNION ALL
        SELECT u.id, u.parent_id
        FROM users u
        INNER JOIN sub s ON u.parent_id = s.id
      )
      SELECT id FROM sub;
    `, [rootUserId]);
    return rows.map((r: any) => Number(r.id));
  }

  async list(params: {
    currentUserId?: number;
    owner_user_id?: number;
    country_code?: string;
    vehicle_type_code?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      currentUserId,
      owner_user_id,
      country_code,
      vehicle_type_code,
      page = 1,
      limit = 20,
    } = params;

    const qb = this.repo.createQueryBuilder('v')
      .leftJoin('v.owner_user', 'ou')
      .orderBy('v.id', 'DESC');

    // 1) اگر admin می‌خواهد فقط یک owner مشخص را ببیند، همان را فیلتر کن
    if (owner_user_id != null) {
      qb.andWhere('ou.id = :owner_user_id', { owner_user_id: Number(owner_user_id) });
    } else if (currentUserId) {
      // 2) نقش‌ها:
      const role = await this.getUserRoleLevel(currentUserId);

      if (role === 1) {
        // مدیرکل: بدون محدودیت
      } else {
        // سایر نقش‌ها: owner در زیرمجموعه یا مسئول خود کاربر
        const ids = await this.getSubtreeUserIds(currentUserId);
        if (ids.length) {
          qb.andWhere('(ou.id IN (:...ids) OR v.responsible_user_id = :me)', {
            ids,
            me: currentUserId,
          });
        } else {
          // زیردستی ندارد → فقط ماشین‌هایی که خودش مسئول‌شان است
          qb.andWhere('v.responsible_user_id = :me', { me: currentUserId });
        }
      }
    }

    // 3) فیلترهای اختیاری
    if (country_code) qb.andWhere('v.country_code = :country_code', { country_code });
    if (vehicle_type_code) qb.andWhere('v.vehicle_type_code = :vehicle_type_code', { vehicle_type_code });

    // 4) صفحه‌بندی
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // 5) ایستگاه‌ها را ضمیمه کن (بدون N+1)
    const vehIds = items.map(v => v.id);
    let itemsWithStations: any[] = items.map(v => ({ ...v, stations: [] }));

    if (vehIds.length) {
      const stRows = await this.stationRepo.find({
        where: { vehicle_id: In(vehIds) as any },
        order: { id: 'ASC' },
      });
      const byVid = new Map<number, any[]>();
      for (const s of stRows) {
        const arr = byVid.get(s.vehicle_id) || [];
        arr.push(s);
        byVid.set(s.vehicle_id, arr);
      }
      itemsWithStations = items.map(v => ({ ...v, stations: byVid.get(v.id) || [] }));
    }

    return { items: itemsWithStations, total, page, limit };
  }

  async bulkAssignResponsible(
    targetUserId: number,
    vehicleIds: number[],
    actorUserId: number,
  ) {
    // 0) ورودی
    const ids = Array.from(new Set((vehicleIds || [])
      .map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0)));

    // 1) وجود کاربر مقصد
    const u = await this.ds.query('select id, role_level from users where id=$1 limit 1', [targetUserId]);
    if (!u?.[0]) throw new BadRequestException('کاربر مقصد (مسئول) یافت نشد');

    // 2) دامنهٔ مالکین مجاز برای actor (به‌جای ردکردن با نقش)
    //    - اگر مدیرکل بود: کل SA/Ownerها
    //    - در غیر این صورت: از منطق قبلی getAllowedOwnerIds
    const actorRole = await this.getUserRoleLevel(actorUserId); // ← امن‌تر و یکدست
    let allowedOwnerIds: number[] = [];

    if (actorRole === 1) {
      // مدیرکل: همهٔ SA و Owner
      try {
        const rows = await this.ds.query('select id from users where role_level = any($1)', [[2, 4]]);
        allowedOwnerIds = rows.map((r: any) => Number(r.id)).filter(Number.isFinite);
      } catch { /* ignore */ }
    } else {
      // بقیه (از جمله SA=2): دامنهٔ مجاز خودش
      allowedOwnerIds = await this.getAllowedOwnerIds(actorUserId);
    }

    if (!allowedOwnerIds.length) {
      throw new ForbiddenException('مالکِ مجاز برای واگذاری در دسترس نیست');
    }

    // 3) فقط خودروهایی را بپذیر که در دامنهٔ allowedOwnerIds باشند
    let allowedVehIds: number[] = [];
    if (ids.length) {
      const rows = await this.repo.createQueryBuilder('v')
        .leftJoin('v.owner_user', 'ou')
        .select(['v.id'])
        .where('v.id IN (:...ids)', { ids })
        .andWhere('ou.id IN (:...owners)', { owners: allowedOwnerIds })
        .getRawMany();
      allowedVehIds = rows.map((r: any) => Number(r.v_id)).filter(Number.isFinite);
    }

    // 4) تراکنش: پاک‌سازی انتساب‌های قبلی targetUser در همین دامنه + ست لیست جدید
    await this.ds.transaction(async (m) => {
      const qb = m.createQueryBuilder();

      // پاک‌سازی مسئولیت‌های قبلی این کاربر فقط برای ownerهای مجاز
      await qb.update(Vehicle)
        .set({ responsible_user: null as any })
        .where('responsible_user_id = :uid', { uid: targetUserId })
        .andWhere('owner_user_id IN (:...owners)', { owners: allowedOwnerIds })
        .execute();

      // ست لیست جدید
      if (allowedVehIds.length) {
        await qb.update(Vehicle)
          .set({ responsible_user: { id: targetUserId } as any })
          .where('id IN (:...ids)', { ids: allowedVehIds })
          .execute();
      }
    });

    return {
      ok: true,
      target_user_id: targetUserId,
      assigned_vehicle_ids: allowedVehIds,
      skipped_vehicle_ids: ids.filter(x => !allowedVehIds.includes(x)),
    };
  }
  // vehicles.service.ts (داخل کلاس VehiclesService)
  async listMineByRole(actorUserId: number, limit = 1000) {
    const role = await this.getUserRoleLevel(actorUserId);

    const qb = this.repo.createQueryBuilder('v')
      .leftJoin('v.owner_user', 'ou')
      .leftJoin('v.responsible_user', 'ru')
      .select([
        'v',            // همه فیلدهای Vehicle
        'ou.id',        // برای دسترسی به owner_user_id
        'ru.id',        // برای دسترسی به responsible_user_id
      ])
      .orderBy('v.id', 'DESC')
      .take(Math.max(1, Math.min(2000, Number(limit) || 1000)));

    if (role === 1) {
      // مدیرکل: بدون محدودیت
      // هیچ where اضافه نمی‌کنیم
    } else if (role === 2) {
      // سوپراَدمین: فقط خودروهایی که owner خودش هست
      qb.where('ou.id = :me', { me: actorUserId });
    } else if (role != null && role >= 3 && role <= 5) {
      // نقش‌های عملیاتی: فقط خودروهایی که خودش مسئولشونه
      qb.where('ru.id = :me', { me: actorUserId });
    } else {
      // نقش ناشناخته/غیرمجاز
      qb.where('1=0');
    }

    const items = await qb.getMany();
    return { items, total: items.length, limit };
  }


  async getCurrentRouteWithMeta(vehicleId: number) {
    const v = await this.repo.findOne({ where: { id: vehicleId }, select: ['id', 'current_route_id'] });
    if (!v?.current_route_id) return null;
    const r = await this.routeRepo.findOne({ where: { id: v.current_route_id }, select: ['id', 'name', 'threshold_m'] });
    if (!r) return null;
    return { route_id: r.id, name: r.name, threshold_m: r.threshold_m };
  }

  async setOrUpdateCurrentRoute(
    vehicleId: number,
    body: { route_id?: number; threshold_m?: number }
  ) {
    const v = await this.repo.findOne({ where: { id: vehicleId }, select: ['id', 'current_route_id'] });
    if (!v) throw new NotFoundException('vehicle not found');

    if (body.route_id != null) {
      const r = await this.routeRepo.findOne({ where: { id: body.route_id } });
      if (!r) throw new NotFoundException('route not found');
      await this.repo.update({ id: vehicleId }, { current_route_id: body.route_id });
    }

    if (body.threshold_m != null) {
      const rid = (body.route_id ?? v.current_route_id) ?? null;
      if (rid != null) {
        this.invalidateRouteCache(rid);
        await this.routeRepo.update({ id: rid }, { threshold_m: body.threshold_m });
      }
    }


    return this.getCurrentRouteWithMeta(vehicleId);
  }
  async getCurrentRouteGeofenceState(vehicleId: number) {
    const v = await this.repo.findOne({ where: { id: vehicleId }, select: ['id', 'current_route_id'] });
    if (!v?.current_route_id) return { active: false };

    // اگر آخرین لوکیشن ذخیره شده داری، فاصله لحظه‌ای را هم برگردانیم (اختیاری)
    const poly = await this.loadRoutePolyline(v.current_route_id);
    let live: any = null;
    try {
      const vv = await this.repo.findOne({
        where: { id: vehicleId },
        select: ['id'] as any,
        // @ts-ignore: فیلدها ممکن است در entity تایپ نشده باشند
      }) as any;
      if ((vv as any).last_location_lat != null && (vv as any).last_location_lng != null && poly) {
        live = this.minDistanceToRouteMeters(poly, (vv as any).last_location_lat, (vv as any).last_location_lng);
      }
    } catch { }

    const st = await this.fenceStateRepo.findOne({ where: { vehicle_id: vehicleId, route_id: v.current_route_id } });
    return {
      active: true,
      route_id: v.current_route_id,
      inside: st?.inside ?? null,
      last_changed_at: st?.last_changed_at ?? null,
      last_distance_m: st?.last_distance_m ?? live?.distance_m ?? null,
      last_segment_index: st?.last_segment_index ?? live?.segment_index ?? null,
      threshold_m: poly?.threshold_m ?? null,
    };
  }
  private async checkRouteGeofence(vehicleId: number, lat: number, lng: number, when: Date) {
    const v = await this.repo.findOne({ where: { id: vehicleId }, select: ['id', 'current_route_id'] });
    const routeId = v?.current_route_id ?? null;
    if (!routeId) return;

    const poly = await this.loadRoutePolyline(routeId);
    if (!poly) return;

    const res = this.minDistanceToRouteMeters(poly, lat, lng);

    let st = await this.fenceStateRepo.findOne({ where: { vehicle_id: vehicleId, route_id: routeId } });
    if (!st) {
      st = this.fenceStateRepo.create({
        vehicle_id: vehicleId,
        route_id: routeId,
        inside: res.inside,
        last_distance_m: res.distance_m,
        last_segment_index: res.segment_index,
        last_changed_at: when,
      });
      await this.fenceStateRepo.save(st);
      return;
    }

    const changed = st.inside !== res.inside;

    st.inside = res.inside;
    st.last_distance_m = res.distance_m;
    st.last_segment_index = res.segment_index;
    await this.fenceStateRepo.save(st);

    if (changed) {
      const ev = this.fenceEventRepo.create({
        vehicle_id: vehicleId,
        route_id: routeId,
        type: res.inside ? 'enter' : 'exit',
        distance_m: res.distance_m,
        segment_index: res.segment_index,
        lat, lng,
      });
      const savedEv = await this.fenceEventRepo.save(ev);

      // راننده دقیق در لحظه‌ی رویداد
      const driverUserId = this.assignments.getDriverByVehicleAt
        ? await this.assignments.getDriverByVehicleAt(vehicleId, when)
        : await this.assignments.getActiveDriverByVehicle(vehicleId);

      if (!res.inside) {
        // فقط یکی از اینها را نگه دار (یا هر دو اگر واقعا هر دو نوع تخلف می‌خواهی)
        await this.violations.addOffRoute({
          vehicleId,
          driverUserId,
          meta: {
            route_id: routeId,
            distance_m: res.distance_m,
            threshold_m: res.threshold_m,
            segment_index: res.segment_index,
            lat, lng,
            event_id: savedEv.id,
            at: when.toISOString(),
          },
        });

        // اگر geofence_exit هم می‌خواهی:
        await this.handleGeofenceExit(vehicleId, lat, lng, when);
      }

      // اگر ستون زمان رویداد در entity اسمش created_at است:
      (this.gw as any)?.emitRouteGeofence?.(vehicleId, {
        route_id: routeId,
        type: ev.type,
        at: (savedEv as any).created_at ?? when.toISOString(),
        distance_m: ev.distance_m,
        segment_index: ev.segment_index,
        lat, lng,
        threshold_m: res.threshold_m,
      });
    }

  }

  async getCurrentRouteGeofenceEvents(vehicleId: number, limit = 50) {
    const v = await this.repo.findOne({ where: { id: vehicleId }, select: ['id', 'current_route_id'] });
    if (!v?.current_route_id) return { items: [] };
    const items = await this.fenceEventRepo.find({
      where: { vehicle_id: vehicleId, route_id: v.current_route_id },
      order: { id: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return { items };
  }

  async unassignCurrentRoute(vehicleId: number) {
    await this.repo.update({ id: vehicleId }, { current_route_id: null as any });
    return { ok: true };
  }

  async listVehicleRoutes(vehicleId: number) {
    const veh = await this.repo.findOne({
      where: { id: vehicleId },
      relations: { owner_user: true },
      select: { id: true, owner_user: { id: true } },
    });
    const ownerUserId = Number(veh?.owner_user?.id);
    if (!ownerUserId) return { items: [] };

    const sa = await this.users.findFirstAncestorByLevel(ownerUserId, 2).catch(() => null);
    const ownerIds: number[] = [];
    if (sa?.id) ownerIds.push(Number(sa.id));
    ownerIds.push(ownerUserId); // 🔧 fallback: مسیرهایی که به نام owner ثبت شده‌اند

    const items = await this.routeRepo.find({
      where: { owner_user_id: In(ownerIds) as any },
      select: ['id', 'name', 'threshold_m'],
      order: { id: 'DESC' },
    });
    return { items };
  }



  // قبلی: کلی شرط روی role و allowedOwners
  private async routeAccessibleByUser(routeId: number, _currentUserId: number) {
    return this.routeRepo.findOne({
      where: { id: routeId },
      select: ['id', 'name', 'threshold_m', 'owner_user_id'],
    });
  }












  private async getOwningSAId(currentUserId: number): Promise<number | null> {
    // 1) مدیرکل: دسترسی آزاد
    const me = await this.ds.query('select id, role_level from users where id=$1 limit 1', [currentUserId]);
    const role = me?.[0]?.role_level ?? null;
    if (role === 1) return null; // null = بدون فیلتر SA (global)

    // 2) اگر خودش SA است، خودش مالک مسیرهای این درخت است
    if (role === 2) return Number(me[0].id);

    // 3) بقیه: SA بالاسری را پیدا کن
    const sa = await this.users.findFirstAncestorByLevel(currentUserId, 2);
    return sa?.id ?? null;
  }


  async createRouteForVehicle(
    vehicleId: number,
    _currentUserId: number,              // عمداً استفاده نمی‌شود
    dto: CreateRouteDto
  ) {
    if (!dto?.name || !Array.isArray(dto.points) || dto.points.length < 2) {
      throw new BadRequestException('name و حداقل 2 نقطه لازم است');
    }

    const createdName = dto.name.trim();
    const createdThreshold =
      Number.isFinite(dto.threshold_m) ? Math.max(1, Math.trunc(dto.threshold_m!)) : 60;

    // فقط وجود وسیله را چک می‌کنیم و owner را (اگر بود) برای route می‌نویسیم
    const veh = await this.repo.findOne({
      where: { id: vehicleId },
      relations: { owner_user: true },
      select: { id: true, owner_user: { id: true } },
    });
    if (!veh) throw new NotFoundException('vehicle not found');

    const vehicleOwnerId = Number(veh.owner_user?.id);
    const ownerValue: number | undefined = Number.isFinite(vehicleOwnerId)
      ? vehicleOwnerId
      : undefined;

    let createdRouteId: number | null = null;

    await this.ds.transaction(async (m) => {
      const routeRepo = m.getRepository(Route);
      const routeStationRepo = m.getRepository(RouteStation);
      const vehicleRepo = m.getRepository(Vehicle);

      // 1) ساخت Route به‌صورت «تکی» (نه آرایه)
      const routeToCreate: DeepPartial<Route> = {
        owner_user_id: ownerValue,   // اگر ستون nullable نیست، مطمئن شو ownerValue تعریف‌شده است
        name: createdName,
        threshold_m: createdThreshold,
      };

      const newRoute = routeRepo.create(routeToCreate);  // <-- واضحاً تکی
      const savedRoute = await routeRepo.save(newRoute); // <-- نوع: Promise<Route>
      createdRouteId = Number(savedRoute.id);

      // 2) ذخیرهٔ ایستگاه‌ها
      const stations = dto.points.map((p, i) =>
        routeStationRepo.create({
          route: { id: savedRoute.id },          // <-- اینجا حالا قطعاً Route تکی داریم
          order_no: (p.order_no ?? i) + 1,
          name: p.name ?? null,
          lat: +p.lat,
          lng: +p.lng,
          radius_m: p.radius_m != null ? Math.trunc(p.radius_m) : null,
        })
      );
      await routeStationRepo.save(stations);

      // 3) بستن مسیر به ماشین
      await vehicleRepo.update({ id: vehicleId }, { current_route_id: savedRoute.id });
    });

    if (createdRouteId != null) this.invalidateRouteCache(createdRouteId);

    return {
      route_id: createdRouteId!,
      name: createdName,
      threshold_m: createdThreshold,
    };
  }












  async getRouteStations(routeId: number) {
    return this.routeStationRepo.find({
      where: { route: { id: routeId } },      // ← relation filter
      order: { order_no: 'ASC' },
    });
  }

  async replaceRouteStations(
    routeId: number,
    stations: { order_no?: number; name?: string; lat: number; lng: number; radius_m?: number | null }[]
  ) {
    if (!Array.isArray(stations) || !stations.length) {
      throw new BadRequestException('stations خالی است');
    }
    await this.routeStationRepo.delete({ route: { id: routeId } });  // 
    this.invalidateRouteCache(routeId); // ⬅️

    await this.routeStationRepo.save(
      stations.map((s, i) =>
        this.routeStationRepo.create({
          route: { id: routeId },             // ←
          order_no: s.order_no ?? i + 1,
          name: s.name ?? null,
          lat: +s.lat,
          lng: +s.lng,
          radius_m: s.radius_m != null ? Math.trunc(s.radius_m) : null,
        })
      )
    );
    return { ok: true };
  }



  async listStationsByRouteForUser(routeId: number, _currentUserId: number) {
    const route = await this.routeRepo.findOne({ where: { id: routeId }, select: ['id'] });
    if (!route) throw new NotFoundException('route not found');

    return this.routeStationRepo.find({
      where: { route: { id: routeId } },
      order: { order_no: 'ASC', id: 'ASC' },
    });
  }



  async deleteRouteForUser(routeId: number, _currentUserId: number) {
    const route = await this.routeAccessibleByUser(routeId, 0);
    if (!route) throw new NotFoundException('route not found');

    await this.ds.transaction(async (m) => {
      await m.getRepository(RouteStation).delete({ route: { id: routeId } });
      await m.getRepository(Vehicle).update({ current_route_id: routeId } as any, { current_route_id: null as any });
      await m.getRepository(Route).delete({ id: routeId });
    });
  }

  async getRouteForUser(routeId: number, _currentUserId: number) {
    const route = await this.routeAccessibleByUser(routeId, 0);
    if (!route) throw new NotFoundException('route not found');
    return { id: route.id, name: route.name, threshold_m: route.threshold_m };
  }


  async replaceRouteStationsForUser(
    routeId: number,
    _currentUserId: number,
    stations: { order_no?: number; name?: string; lat: number; lng: number; radius_m?: number | null }[],
  ) {
    const route = await this.routeAccessibleByUser(routeId, 0);
    if (!route) throw new NotFoundException('route not found');
    return this.replaceRouteStations(routeId, stations);
  }



  async updateRouteForUser(
    routeId: number,
    _currentUserId: number,
    body: {
      name?: string;
      threshold_m?: number;
      stations?: { order_no?: number; name?: string; lat: number; lng: number; radius_m?: number | null }[];
    }
  ) {
    const route = await this.routeAccessibleByUser(routeId, 0);
    if (!route) throw new NotFoundException('route not found');

    const patch: Partial<Route> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (Number.isFinite(body.threshold_m)) patch.threshold_m = Math.max(1, Math.trunc(body.threshold_m!));
    this.invalidateRouteCache(routeId);

    await this.ds.transaction(async (m) => {
      if (Object.keys(patch).length) {
        await m.getRepository(Route).update({ id: routeId }, patch);
      }
      if (Array.isArray(body.stations)) {
        await m.getRepository(RouteStation).delete({ route: { id: routeId } });
        await m.getRepository(RouteStation).save(
          body.stations.map((s, i) =>
            m.getRepository(RouteStation).create({
              route: { id: routeId },
              order_no: s.order_no ?? i + 1,
              name: s.name ?? null,
              lat: +s.lat,
              lng: +s.lng,
              radius_m: s.radius_m != null ? Math.trunc(s.radius_m) : null,
            })
          )
        );
      }
    });

    return this.routeRepo.findOne({ where: { id: routeId }, select: ['id', 'name', 'threshold_m'] });
  }

  private normType(s?: string) {
    return String(s || '').toLowerCase().replace(/[-_]/g, '');
  }
  async listAccessible(args: { userId: number; vehicleTypeCode?: string; limit?: number }) {
    const { userId, vehicleTypeCode, limit = 1000 } = args;

    // 1) owner ها از روی پالیسی‌های Allowed
    const pols = await this.vehiclePolicies.getForUser(userId, true).catch(() => []);
    const ownerIds = Array.from(new Set(
      (pols || [])
        .map((p: any) => Number(p.owner_user_id ?? p.ownerId ?? p.super_admin_user_id ?? p.grantor_user_id))
        .filter(n => Number.isFinite(n))
    ));

    // 2) fallback: اولین SA در شجره
    let ownerId: number | null = ownerIds[0] ?? null;

    if (!ownerId) {
      const sa = await this.users.findFirstAncestorByLevel?.(userId, 2).catch(() => null);
      ownerId = sa?.id ?? null; // حالا type number | null هست و خطا نمی‌ده
    }

    // استفاده:
    const params: any = { limit: 1000 };
    if (ownerId !== null) {
      params.owner_user_id = ownerId;
    }

    if (!ownerId) return { items: [], total: 0, page: 1, limit };

    const qb = this.repo.createQueryBuilder('v')
      .where('(v.owner_user_id = :oid OR v.responsible_user_id = :me)', { oid: ownerId, me: userId })
      .orderBy('v.plate_no', 'ASC')
      .take(limit);

    if (vehicleTypeCode) {
      qb.andWhere('LOWER(REPLACE(v.vehicle_type_code, \'_\', \'\')) = :vt', {
        vt: this.normType(vehicleTypeCode),
      });
    }


    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: 1, limit };
  }
  // vehicles.service.ts

  private async getAllowedOwnerIds(userId: number): Promise<number[]> {
    const ids = new Set<number>();
    let role: number | null = null;
    try {
      const r = await this.ds.query('select role_level from users where id = $1 limit 1', [userId]);
      role = r?.[0]?.role_level ?? null;
    } catch { }

    if (role === 1) {
      // ⚠️ قبلاً فقط level=4 بود؛ الان SAها را هم اضافه می‌کنیم
      try {
        const rows = await this.ds.query(
          'select id from users where role_level = ANY($1)',
          [[2, 4]] // 2 = SuperAdmin, 4 = Owner
        );
        rows.forEach((row: any) => ids.add(Number(row.id)));
      } catch { }
    } else {
      // (همان لاجیک قبلی)
      ids.add(userId);
      try {
        const sa = await this.users.findFirstAncestorByLevel?.(userId, 2);
        if (sa?.id) ids.add(Number(sa.id));
      } catch { }
      try {
        const pols = await this.vehiclePolicies.getForUser(userId, true).catch(() => []);
        (pols || []).forEach((p: any) => {
          const cand = Number(p.owner_user_id ?? p.ownerId ?? p.super_admin_user_id ?? p.grantor_user_id);
          if (Number.isFinite(cand)) ids.add(cand);
        });
      } catch { }
    }
    return Array.from(ids);
  }







}


const PERSIAN_LETTERS = 'ابپتثجچحخدذرزسشصضطظعغفقکگلمنوهی';
function isPlateValidForCountry(country: string, raw: string): boolean {
  const p = raw.replace(/\s|-/g, '').trim();

  switch (country) {
    case 'IR': {
      // فرمت: 2 رقم + 1 حرف فارسی + 3 رقم + 2 رقم
      const pattern = /^(\d{2})([\u0600-\u06FF])(\d{3})(\d{2})$/;
      return pattern.test(p);
    }
    case 'QA':
    case 'AE':
    case 'IQ':
    case 'AF':
    case 'TM':
    case 'TR':
      return /^[A-Z0-9]{5,10}$/.test(p);
    default:
      return false;
  }


}



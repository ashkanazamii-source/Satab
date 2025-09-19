import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/create-vehicle.dto';
import { normalizePlate } from '../dto/create-vehicle.dto';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';
import { VehicleTrack } from './vehicle-track.entity';
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
import { ViolationsService } from '../telemetry/violations.service'; // ⬅️ اضافه
import { DriverVehicleAssignmentService } from '../driver-vehicle-assignment/driver-vehicle-assignment.service';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleStation) private readonly stationRepo: Repository<VehicleStation>,
    @InjectRepository(VehicleTrack) private readonly trackRepo: Repository<VehicleTrack>,
    @InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>,
    @InjectRepository(VehiclePolicy) private readonly policyRepo: Repository<VehiclePolicy>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(RouteStation) private readonly routeStationRepo: Repository<RouteStation>,
    @InjectRepository(RouteGeofenceState) private readonly fenceStateRepo: Repository<RouteGeofenceState>,   // ⬅️
    @InjectRepository(RouteGeofenceEvent) private readonly fenceEventRepo: Repository<RouteGeofenceEvent>,   // ⬅️
    private readonly ds: DataSource,
    private readonly gw: VehiclesGateway,
    private readonly vehiclePolicies: VehiclePoliciesService,
    private readonly users: UserService,
    private readonly violations: ViolationsService, // ⬅️ تزریق
    private readonly assignments: DriverVehicleAssignmentService,
  ) { }

  private routeCache = new Map<number, { points: { lat: number; lng: number }[], threshold_m: number }>();
  private toMeters(latRef: number, lat: number, lng: number) {
    const mPerDegLat = 111_320;                 // ~
    const mPerDegLng = 111_320 * Math.cos(latRef * Math.PI / 180);
    return { x: lng * mPerDegLng, y: lat * mPerDegLat };
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
    return this.stationRepo.find({
      where: { vehicle_id: vehicleId },   // فقط بر اساس ماشین
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


    if (Object.keys(patch).length) {
      await this.repo.update({ id: vehicleId }, patch);
    }
  }

  async readVehicleTelemetry(vehicleId: number, keys: string[] = []) {
    const out: any = {};
    const v = await this.repo.findOne({
      where: { id: vehicleId },
      relations: { owner_user: true },
      select: { id: true, vehicle_type_code: true, owner_user: { id: true } },
    });
    if (!v) throw new NotFoundException('Vehicle not found');

    const pol = await this.policyRepo.findOne({
      where: { user_id: Number(v.owner_user?.id), vehicle_type_code: v.vehicle_type_code },
    });

    if (!v) return out;

    if (!keys.length || keys.includes('ignition')) out.ignition = v.ignition ?? null;
    if (!keys.length || keys.includes('idle_time')) out.idle_time = v.idle_time_sec ?? null;
    if (!keys.length || keys.includes('odometer')) out.odometer = v.odometer_km ?? null;
    if (!keys.length || keys.includes('engine_on_duration')) out.engine_on_duration = v.ignition_on_sec_since_reset ?? 0;

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
      const owners = await this.getAllowedOwnerIds(actorUserId);
      const veh = await this.repo.findOne({
        where: { id: vehicleId, owner_user: { id: In(owners) as any } },   // ✅ رابطه‌ای
        relations: { owner_user: true },
        select: { id: true, owner_user: { id: true } },                    // ✅ nested select
      });
      if (!veh) throw new NotFoundException('vehicle not found or not accessible');
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





  async ingestVehiclePos(vehicleId: number, lat: number, lng: number, ts?: string) {
    const when = ts ? new Date(ts) : new Date();
    await this.trackRepo.insert({ vehicle_id: vehicleId, lat, lng, ts: when });
    await this.checkRouteGeofence(vehicleId, lat, lng, when); // ⬅️ اضافه شد

    // اگر در جدول vehicles ستون‌های last_location داری:
    await this.repo.update({ id: vehicleId }, {
      // @ts-ignore - بسته به اسکیمای خودت
      last_location_lat: lat,
      last_location_lng: lng,
      last_location_ts: when as any,
    });

    // برادکست برای کلاینت‌ها (نام ایونت مطابق فرانت فعلی)
    this.gw.emitVehiclePos(vehicleId, lat, lng, when.toISOString());
  }

  async getVehicleTrack(vehicleId: number, from: Date, to: Date) {
    return this.trackRepo.find({
      where: { vehicle_id: vehicleId, ts: Between(from, to) },
      order: { ts: 'ASC' },
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

  async update(id: number, dto: UpdateVehicleDto) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('وسیله یافت نشد');

    if (dto.tracker_imei) {
      const imei = dto.tracker_imei.trim().toUpperCase();
      const dup = await this.repo.findOne({ where: { tracker_imei: imei, id: Not(id) } });
      if (dup) throw new BadRequestException('این UID/IMEI قبلاً ثبت شده است.');
      dto.tracker_imei = imei;
    }

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

  async list(params: { currentUserId?: number; owner_user_id?: number; country_code?: string; vehicle_type_code?: string; page?: number; limit?: number; }) {
    const { currentUserId, owner_user_id, country_code, vehicle_type_code, page = 1, limit = 20 } = params;

    const qb = this.repo.createQueryBuilder('v').leftJoin('v.owner_user', 'ou').orderBy('v.id', 'DESC');

    if (owner_user_id != null) {
      qb.andWhere('ou.id = :owner_user_id', { owner_user_id: Number(owner_user_id) });
    } else if (currentUserId) {
      // ⬇️ منیجر: هیچ محدودیتی
      const role = await this.getUserRoleLevel(currentUserId);
      if (role !== 1) {
        const ids = await this.getSubtreeUserIds(currentUserId);
        if (ids.length) qb.andWhere('ou.id IN (:...ids)', { ids });
        else qb.andWhere('1=0');
      }
    }

    if (country_code) qb.andWhere('v.country_code = :country_code', { country_code });
    if (vehicle_type_code) qb.andWhere('v.vehicle_type_code = :vehicle_type_code', { vehicle_type_code });

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const vehIds = items.map(v => v.id);
    let itemsWithStations: any[] = items.map(v => ({ ...v, stations: [] }));

    if (vehIds.length) {
      const stRows = await this.stationRepo.find({ where: { vehicle_id: In(vehIds) as any }, order: { id: 'ASC' } });
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


  /////////////////////////////////////////////////////////////////////////////////////////////////////
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
    if (changed) st.last_changed_at = when;
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

      // ✅ فقط در «خروج» از مسیر تخلف ثبت کن
      if (!res.inside) {
        // رانندهٔ فعال با سرویس انتساب
        const driverUserId = await this.assignments.getActiveDriverByVehicle(vehicleId);

        // متای کامل (برای گزارشات)
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
      }

      // برادکست اختیاری به UI
      (this.gw as any)?.emitRouteGeofence?.(vehicleId, {
        route_id: routeId,
        type: ev.type,
        at: (savedEv as any).at,
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
      .where('v.owner_user_id = :oid', { oid: ownerId })
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



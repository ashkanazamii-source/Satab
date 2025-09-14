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

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleStation) private readonly stationRepo: Repository<VehicleStation>,
    @InjectRepository(VehicleTrack) private readonly trackRepo: Repository<VehicleTrack>,
    @InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>,
    @InjectRepository(VehiclePolicy) private readonly policyRepo: Repository<VehiclePolicy>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(RouteStation) private readonly routeStationRepo: Repository<RouteStation>,
    private readonly ds: DataSource,
    private readonly gw: VehiclesGateway,
    private readonly vehiclePolicies: VehiclePoliciesService,
    private readonly users: UserService, // اگر متود ancestor داری
  ) { }

  // vehicles.service.ts
  async listStationsByVehicleForUser(vehicleId: number, _currentUserId: number) {
    return this.stationRepo.find({
      where: { vehicle_id: vehicleId },   // فقط بر اساس ماشین
      order: { id: 'ASC' },
    });
  }
  p// vehicles.service.ts (داخل کلاس VehiclesService)

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
    // 1) اجازه‌ی افزودن ایستگاه
    if (!(await this.canUserAddStations(currentUserId))) {
      throw new ForbiddenException('adding stations is not allowed');
    }

    // 2) گرفتن مالک وسیله بدون selectِ ستون اشتباه
    const veh = await this.repo.findOne({
      where: { id: vehicleId },
      relations: ['owner_user'],   // ⬅️ رلیشن را لود کن
      select: ['id'],              // فقط id خود Vehicle کافی است
    });
    if (!veh) throw new NotFoundException('vehicle not found');
    const ownerId = veh.owner_user?.id;
    if (!ownerId) throw new NotFoundException('vehicle owner not found');

    // 3) ساخت ایستگاه
    const st = this.stationRepo.create({
      vehicle_id: vehicleId,
      owner_user_id: Number(ownerId),
      name: (dto.name ?? 'ایستگاه').trim(),
      lat: +dto.lat,
      lng: +dto.lng,
      radius_m: dto.radius_m && dto.radius_m > 0 ? Math.min(+dto.radius_m, 5000) : 100,
    });

    const saved = await this.stationRepo.save(st);

    // 4) برادکست
    this.gw.emitStationsChanged(vehicleId, Number(ownerId), { type: 'created', station: saved });

    return saved;
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
    data: { ignition?: boolean; idle_time?: number; odometer?: number; ts?: string }
  ) {
    const ts = data.ts ? new Date(data.ts) : new Date();

    if (data.ignition !== undefined) {
      await this.applyIgnitionAccum(vehicleId, data.ignition, ts);
      this.gw.emitIgnition(vehicleId, data.ignition, ts.toISOString());
    }

    const patch: any = {}; // ⬅️ last_telemetry_at حذف شد
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
    // اگر actor می‌دهی، دسترسی را چک کن
    if (actorUserId != null) {
      const owners = await this.getAllowedOwnerIds(actorUserId);
      const veh = await this.repo.findOne({
        where: { id: vehicleId, owner_user_id: In(owners) as any },
        select: ['id', 'owner_user_id'],
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



  // vehicles.service.ts
  async readVehicleTelemetry(vehicleId: number, keys: string[] = []) {
    const out: any = {};

    const v = await this.repo.findOne({
      where: { id: vehicleId },
      // 👇 حتماً id را هم انتخاب کن تا TypeORM //DISTINCT...ORDER BY Vehicle_id// نسازه و خطا نده
      select: ['id', 'ignition', 'idle_time_sec', 'odometer_km', 'ignition_on_sec_since_reset'],
    });

    if (!v) return out;

    if (!keys.length || keys.includes('ignition')) out.ignition = v.ignition ?? null;
    if (!keys.length || keys.includes('idle_time')) out.idle_time = v.idle_time_sec ?? null;
    if (!keys.length || keys.includes('odometer')) out.odometer = v.odometer_km ?? null;
    if (!keys.length || keys.includes('engine_on_duration'))
      out.engine_on_duration = v.ignition_on_sec_since_reset ?? 0;

    return out;
  }


  async ingestVehiclePos(vehicleId: number, lat: number, lng: number, ts?: string) {
    const when = ts ? new Date(ts) : new Date();
    await this.trackRepo.insert({ vehicle_id: vehicleId, lat, lng, ts: when });

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

    // ⚠️ مهم: روی relation فیلتر کن تا خطای "owner_user_id not found" نخوریم
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoin('v.owner_user', 'ou')
      .orderBy('v.id', 'DESC');

    if (owner_user_id != null) {
      qb.andWhere('ou.id = :owner_user_id', { owner_user_id: Number(owner_user_id) });
    } else if (currentUserId) {
      const ids = await this.getSubtreeUserIds(currentUserId);
      if (ids.length) qb.andWhere('ou.id IN (:...ids)', { ids });
      else qb.andWhere('1=0');
    }

    if (country_code) qb.andWhere('v.country_code = :country_code', { country_code });
    if (vehicle_type_code) qb.andWhere('v.vehicle_type_code = :vehicle_type_code', { vehicle_type_code });

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // ===== ایستگاه‌ها را برای همه‌ی وسایل با یک کوئری بگیر و ضمیمه کن
    const vehIds = items.map(v => v.id);  // ⬅️ قبلاً const ids بود
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

      itemsWithStations = items.map(v => ({
        ...v,
        stations: byVid.get(v.id) || [],
      }));
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
      const rid = body.route_id ?? v.current_route_id;
      if (rid) {
        await this.routeRepo.update({ id: rid }, { threshold_m: body.threshold_m });
      }
    }

    return this.getCurrentRouteWithMeta(vehicleId);
  }

  async unassignCurrentRoute(vehicleId: number) {
    await this.repo.update({ id: vehicleId }, { current_route_id: null as any });
    return { ok: true };
  }

  async listVehicleRoutes(vehicleId: number) {
    // 👈 owner_user_id را انتخاب نکن؛ relation را لود کن
    const veh = await this.repo.findOne({
      where: { id: vehicleId },
      relations: ['owner_user'], // تا بتوانیم veh.owner_user.id را داشته باشیم
      select: ['id'],            // فقط id لازم است
    });

    if (!veh || !veh.owner_user?.id) return { items: [] };

    const items = await this.routeRepo.find({
      where: { owner_user_id: veh.owner_user.id },   // 👈 بر اساس ستون واقعی در Route
      select: ['id', 'name', 'threshold_m'],
      order: { id: 'DESC' },
    });

    return { items };
  }
  // جایگزینِ قبلی:


  // نسخه‌ی درست (استفاده از allowed owners):
  private async routeOwnedByAllowedOwners(routeId: number, currentUserId: number) {
    const owners = await this.getAllowedOwnerIds(currentUserId);
    return this.routeRepo.findOne({
      where: { id: routeId, owner_user_id: In(owners) as any },
      select: ['id', 'owner_user_id', 'name', 'threshold_m'],
    });
  }

  async deleteRouteForUser(routeId: number, currentUserId: number) {
    const route = await this.routeOwnedByAllowedOwners(routeId, currentUserId);
    if (!route) throw new NotFoundException('route not found');

    await this.ds.transaction(async (m) => {
      await m.getRepository(RouteStation).delete({ route_id: routeId });
      await m.getRepository(Vehicle).update({ current_route_id: routeId } as any, { current_route_id: null as any });
      await m.getRepository(Route).delete({ id: routeId });
    });

    // (اختیاری) اگر نیاز داری رویداد سوکتی بدهی اینجا emit کن
  }


  async createRouteForVehicle(
    vehicleId: number,
    currentUserId: number,
    dto: {
      name: string;
      threshold_m?: number;
      points: { lat: number; lng: number; name?: string; radius_m?: number }[];
    }
  ) {
    if (!dto?.name || !Array.isArray(dto.points) || dto.points.length < 2) {
      throw new BadRequestException('name و حداقل 2 نقطه لازم است');
    }

    // ⬅️ بدون select
    const veh = await this.repo.findOne({ where: { id: vehicleId } });
    if (!veh) throw new NotFoundException('vehicle not found');

    const ownerUserId = veh.owner_user_id; // ✅

    const route = await this.routeRepo.save(
      this.routeRepo.create({
        owner_user_id: ownerUserId,
        name: dto.name.trim(),
        threshold_m: Number.isFinite(dto.threshold_m)
          ? Math.max(1, Math.trunc(dto.threshold_m!))
          : 60,
      })
    );

    await this.routeStationRepo.save(
      dto.points.map((p, i) =>
        this.routeStationRepo.create({
          route_id: route.id,
          order_no: i + 1,
          name: p.name ?? null,
          lat: +p.lat,
          lng: +p.lng,
          radius_m: p.radius_m != null ? Math.trunc(p.radius_m) : null,
        })
      )
    );

    await this.repo.update({ id: vehicleId }, { current_route_id: route.id });

    return { route_id: route.id };
  }


  async getRouteStations(routeId: number) {
    return this.routeStationRepo.find({
      where: { route_id: routeId },
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
    await this.routeStationRepo.delete({ route_id: routeId });
    await this.routeStationRepo.save(
      stations.map((s, i) =>
        this.routeStationRepo.create({
          route_id: routeId,
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


  async listStationsByRouteForUser(routeId: number, currentUserId: number) {
    const route = await this.routeOwnedByAllowedOwners(routeId, currentUserId);
    if (!route) throw new NotFoundException('route not found');
    return this.routeStationRepo.find({
      where: { route_id: routeId },
      order: { order_no: 'ASC', id: 'ASC' },
    });
  }

  async getRouteForUser(routeId: number, currentUserId: number) {
    const route = await this.routeOwnedByAllowedOwners(routeId, currentUserId);
    if (!route) throw new NotFoundException('route not found');
    return route; // {id, owner_user_id, name, threshold_m}
  }
  async replaceRouteStationsForUser(
    routeId: number,
    currentUserId: number,
    stations: { order_no?: number; name?: string; lat: number; lng: number; radius_m?: number | null }[]
  ) {
    const route = await this.routeOwnedByAllowedOwners(routeId, currentUserId);
    if (!route) throw new NotFoundException('route not found');
    return this.replaceRouteStations(routeId, stations);
  }

  async updateRouteForUser(
    routeId: number,
    currentUserId: number,
    body: {
      name?: string;
      threshold_m?: number;
      stations?: { order_no?: number; name?: string; lat: number; lng: number; radius_m?: number | null }[];
    }
  ) {
    const route = await this.routeOwnedByAllowedOwners(routeId, currentUserId);
    if (!route) throw new NotFoundException('route not found');

    const patch: Partial<Route> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (Number.isFinite(body.threshold_m)) patch.threshold_m = Math.max(1, Math.trunc(body.threshold_m!));

    await this.ds.transaction(async (m) => {
      if (Object.keys(patch).length) {
        await m.getRepository(Route).update({ id: routeId }, patch);
      }
      if (Array.isArray(body.stations)) {
        // جایگزینی کامل ایستگاه‌ها
        await m.getRepository(RouteStation).delete({ route_id: routeId });
        await m.getRepository(RouteStation).save(
          body.stations.map((s, i) =>
            m.getRepository(RouteStation).create({
              route_id: routeId,
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
  // vehicles.service.ts (افزودن helper)
  private async getAllowedOwnerIds(userId: number): Promise<number[]> {
    const ids = new Set<number>([userId]);

    // SA والد (جدّ سطح 2) – اگر متود داری
    try {
      const sa = await this.users.findFirstAncestorByLevel?.(userId, 2);
      if (sa?.id) ids.add(Number(sa.id));
    } catch { }

    // owners از روی policyهای مجاز
    try {
      const pols = await this.vehiclePolicies.getForUser(userId, true).catch(() => []);
      (pols || []).forEach((p: any) => {
        const cand = Number(
          p.owner_user_id ?? p.ownerId ?? p.super_admin_user_id ?? p.grantor_user_id
        );
        if (Number.isFinite(cand)) ids.add(cand);
      });
    } catch { }

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



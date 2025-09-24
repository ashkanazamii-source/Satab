// src/temporary-assignments/temporary-assignments.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TemporaryVehicleAssignment, VehicleSettingsSnapshot } from './temporary-vehicle-assignment.entity';

type AnyRec = Record<string, any>;


@Injectable()
export class TemporaryAssignmentsService {
  constructor(
    @InjectRepository(TemporaryVehicleAssignment) private readonly repo: Repository<TemporaryVehicleAssignment>,
    private readonly http: HttpService,
  ) { }

  // ---------- HTTP helpers ----------
  private async httpGet<T>(url: string, params?: any) {
    const res = await firstValueFrom(this.http.get<T>(url, { params, validateStatus: () => true }));
    return { data: res.data as any, status: res.status };
  }
  private async httpPost<T>(url: string, body?: any) {
    const res = await firstValueFrom(this.http.post<T>(url, body, { validateStatus: () => true }));
    return { data: res.data as any, status: res.status };
  }
  private async httpPut<T>(url: string, body?: any) {
    const res = await firstValueFrom(this.http.put<T>(url, body, { validateStatus: () => true }));
    return { data: res.data as any, status: res.status };
  }
  private async httpDelete<T>(url: string) {
    const res = await firstValueFrom(this.http.delete<T>(url, { validateStatus: () => true }));
    return { data: res.data as any, status: res.status };
  }

  // ---------- utils ----------
  private num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
  private toInt = (v: any, min = 1) => Math.max(min, Math.trunc(Number(v || 0)));

  private mergeExtrasSafe(known: Record<string, any>, extras?: Record<string, any>) {
    if (!extras || typeof extras !== 'object') return { ...known };
    const out: any = { ...known };
    for (const [k, v] of Object.entries(extras)) {
      if (k in known) continue;
      out[k] = v;
    }
    return out;
  }

  // امضای normStation را دقیق کن
  private normStation = (raw: AnyRec, i: number): Station | null => {
    const id = this.num(raw?.id ?? raw?.station_id);
    const name = (raw?.name ?? '').toString().trim() || 'ایستگاه';
    const lat = this.num(raw?.lat ?? raw?.latitude);
    const lng = this.num(raw?.lng ?? raw?.longitude);
    if (lat == null || lng == null) return null;
    const radius_m = this.toInt(raw?.radius_m ?? raw?.radiusM ?? raw?.radius ?? 60, 1);
    const order_no = this.num(raw?.order_no ?? raw?.orderNo ?? raw?.order ?? i + 1) ?? undefined;
    // نگه‌داشتن extras، ولی موقع ارسال payload با mergeExtrasSafe جلوی duplicate گرفته میشه
    return { id: id ?? undefined, name, lat, lng, radius_m, order_no, ...raw };
  };

  private normPoint = (raw: AnyRec, i: number) => {
    const lat = this.num(raw?.lat ?? raw?.latitude);
    const lng = this.num(raw?.lng ?? raw?.longitude);
    if (lat == null || lng == null) return null;
    const order_no = this.num(raw?.order_no ?? raw?.orderNo ?? raw?.order ?? i + 1) ?? undefined;
    return { lat, lng, order_no, ...raw };
  };

  private normRoute = (raw: AnyRec) => {
    if (!raw) return null;
    const id = this.num(raw?.id ?? raw?.route_id ?? raw?.routeId) ?? undefined;
    const threshold_m = this.toInt(raw?.threshold_m ?? raw?.thresholdM ?? 60, 1);
    const name = raw?.name ? String(raw.name) : undefined;
    return { id, name, threshold_m };
  };

  private normGeofence = (raw: AnyRec) => {
    if (!raw) return null;
    const id = this.num(raw?.id ?? raw?.geofence_id) ?? undefined;
    const type = String(raw?.type ?? '').toLowerCase();
    const tolerance_m = this.toInt(raw?.tolerance_m ?? raw?.toleranceM ?? 15, 0);
    if (type === 'circle') {
      const centerLat = this.num(raw?.centerLat ?? raw?.center_lat ?? raw?.center?.lat);
      const centerLng = this.num(raw?.centerLng ?? raw?.center_lng ?? raw?.center?.lng);
      const radius_m = this.toInt(raw?.radiusM ?? raw?.radius_m ?? raw?.radius ?? 0, 1);
      if (centerLat == null || centerLng == null) return null;
      return { id, type: 'circle' as const, center: { lat: centerLat, lng: centerLng }, radius_m, tolerance_m, ...raw };
    } else {
      const ptsRaw: any[] = Array.isArray(raw?.polygonPoints ?? raw?.points) ? (raw?.polygonPoints ?? raw?.points) : [];
      const points = ptsRaw
        .map((p: any) => {
          const lat = this.num(p?.lat ?? p?.latitude);
          const lng = this.num(p?.lng ?? p?.longitude);
          if (lat == null || lng == null) return null;
          return { lat, lng, ...p };
        })
        .filter(Boolean) as any[];
      if (points.length < 3) return null;
      return { id, type: 'polygon' as const, points, tolerance_m, ...raw };
    }
  };

  private pruneNullishDeep<T = any>(x: T): T {
    if (Array.isArray(x)) {
      return x.map(v => this.pruneNullishDeep(v)).filter(v => v !== undefined && v !== null) as any;
    }
    if (x && typeof x === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(x)) {
        const vv = this.pruneNullishDeep(v as any);
        if (vv === undefined || vv === null) continue;
        if (Array.isArray(vv) && vv.length === 0) continue;
        out[k] = vv;
      }
      return out;
    }
    return x;
  }


  // ============================================================
  // 2) پاک‌سازی (route current + همهٔ ایستگاه‌های خودرو + ژئوفنس)
  // ============================================================
  private async clearVehicleSettings(vid: number): Promise<void> {
    // 1) Route current → اول null کن، بعد هم DELETE بزن (هر دو بی‌قید و شرط)
    await this.httpPut(`/vehicles/${vid}/routes/current`, { route_id: null }).catch(() => undefined);
    await this.httpDelete(`/vehicles/${vid}/routes/current`).catch(() => undefined);

    // 2) Vehicle stations → هر چی هست پاک کن (تک‌به‌تک). در پایان هم یک DELETE کلی (اگر بک‌اند ساپورت کند)
    let items: any[] = [];
    try {
      const res = await this.httpGet<any>(`/vehicles/${vid}/stations`, { _: Date.now() });
      items = Array.isArray(res?.data?.items) ? res.data.items : (Array.isArray(res?.data) ? res.data : []);
    } catch { /* ignore list fetch errors */ }

    for (const s of items) {
      const sid = Number(s?.id);
      await this.httpDelete(`/vehicles/${vid}/stations/${sid}`).catch(() => undefined);
    }

    // تلاش برای پاکسازی جمعی (اگر endpoint وجود نداشت، catch می‌شود)
    await this.httpDelete(`/vehicles/${vid}/stations`).catch(() => undefined);

    // 3) Geofence → بی‌قید و شرط حذف
    await this.httpDelete(`/vehicles/${vid}/geofence`).catch(() => undefined);
  }


  // ============================================================
  // 3) اعمال دقیق اسنپ‌شات با همان idها و همان URLها:
  //    Route current: PUT /vehicles/:vid/routes/current
  //    Route stations: GET/PUT/POST/DELETE روی /routes/:rid/stations (و /routes/:rid/stations/:sid)
  //    Vehicle stations: GET/PUT/POST/DELETE روی /vehicles/:vid/stations (و /vehicles/:vid/stations/:sid)
  //    Geofence: PUT/POST /vehicles/:vid/geofence
  // ============================================================
  private async applySnapshotExactly(vid: number, snap: Snapshot) {
    // 3.A) Route current
    let rid: number | null = snap.route?.id ?? null;
    const threshold_m = this.toInt(snap.route?.threshold_m ?? 60, 1);

    if (rid != null) {
      await this.httpPut(`/vehicles/${vid}/routes/current`, { route_id: rid, threshold_m }).catch(() => undefined);
    } else {
      const pts = (snap.route_stations || [])
        .map((s) => ({ lat: s.lat, lng: s.lng, order_no: s.order_no }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (pts.length >= 2) {
        const created =
          (await this.httpPost(`/routes`, { name: `Aux Route ${new Date().toISOString().slice(0, 10)}`, threshold_m, points: pts }).catch(
            async () =>
            (await this.httpPost(`/vehicles/${vid}/routes`, {
              name: `Aux Route ${new Date().toISOString().slice(0, 10)}`,
              threshold_m,
              points: pts,
            }))
          ))?.data || {};
        const v = created?.id ?? created?.route_id ?? created?.route?.id;
        if (Number.isFinite(Number(v))) {
          rid = Number(v);
          await this.httpPut(`/vehicles/${vid}/routes/current`, { route_id: rid, threshold_m }).catch(() => undefined);
        }
      }
    }

    // 3.B) Route stations (upsert با id)
    if (rid != null) {
      let cur: any[] = [];
      try {
        const r = await this.httpGet<any>(`/routes/${rid}/stations`);
        cur = Array.isArray(r.data) ? r.data : [];
      } catch { /* ignore */ }

      const wanted = snap.route_stations || [];
      const wantedIds = new Set(wanted.map((s) => this.num(s.id)).filter((x) => x != null) as number[]);

      // حذف اضافی‌ها
      for (const c of cur) {
        const sid = this.num(c?.id);
        if (sid != null && !wantedIds.has(sid)) {
          await this.httpDelete(`/routes/${rid}/stations/${sid}`).catch(() => undefined);
        }
      }

      // upsert
      for (const s of wanted) {
        const {
          id: _sid,
          name: _sn,
          lat: _slat,
          lng: _slng,
          latitude: _slat2,
          longitude: _slng2,
          radius_m: _srm,
          radiusM: _srm2,
          radius: _srm3,
          order_no: _so,
          orderNo: _so2,
          order: _so3,
          ...extras
        } = (s || {}) as Record<string, any>;

        const lat = this.num(s.lat ?? s.latitude);
        const lng = this.num(s.lng ?? s.longitude);
        const radius_m = this.toInt(s.radius_m ?? s.radiusM ?? s.radius ?? 60, 1);
        const order_no = this.num(s.order_no ?? s.orderNo ?? s.order) ?? undefined;
        const name = (s.name ?? '').toString().trim() || 'ایستگاه';

        const payloadBase = { name, lat, lng, radius_m, order_no };
        const payload = this.mergeExtrasSafe(payloadBase, extras);

        const sid = this.num(s.id);
        if (sid != null) {
          await this.httpPut(`/routes/${rid}/stations/${sid}`, payload).catch(async () => {
            await this.httpDelete(`/routes/${rid}/stations/${sid}`).catch(() => undefined);
            await this.httpPost(`/routes/${rid}/stations`, payload).catch(() => undefined);
          });
        } else {
          await this.httpPost(`/routes/${rid}/stations`, payload).catch(() => undefined);
        }
      }
    }

    // 3.C) Vehicle stations (upsert با id)
    {
      let cur: any[] = [];
      try {
        const r = await this.httpGet<any>(`/vehicles/${vid}/stations`, { _: Date.now() });
        cur = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.items) ? r.data.items : [];
      } catch { /* ignore */ }

      const wanted = snap.vehicle_stations || [];
      const wantedIds = new Set(wanted.map((s) => this.num(s.id)).filter((x) => x != null) as number[]);

      for (const c of cur) {
        const sid = this.num(c?.id);
        if (sid != null && !wantedIds.has(sid)) {
          await this.httpDelete(`/vehicles/${vid}/stations/${sid}`).catch(() => undefined);
        }
      }

      for (const s of wanted) {
        const {
          id: _sid,
          name: _sn,
          lat: _slat,
          lng: _slng,
          latitude: _slat2,
          longitude: _slng2,
          radius_m: _srm,
          radiusM: _srm2,
          radius: _srm3,
          order_no: _so,
          orderNo: _so2,
          order: _so3,
          ...extras
        } = (s || {}) as Record<string, any>;

        const lat = this.num(s.lat ?? s.latitude);
        const lng = this.num(s.lng ?? s.longitude);
        const radius_m = this.toInt(s.radius_m ?? s.radiusM ?? s.radius ?? 60, 1);
        const order_no = this.num(s.order_no ?? s.orderNo ?? s.order) ?? undefined;
        const name = (s.name ?? '').toString().trim() || 'ایستگاه';

        const payloadBase = { name, lat, lng, radius_m, order_no };
        const payload = this.mergeExtrasSafe(payloadBase, extras);

        const sid = this.num(s.id);
        if (sid != null) {
          await this.httpPut(`/vehicles/${vid}/stations/${sid}`, payload).catch(async () => {
            await this.httpDelete(`/vehicles/${vid}/stations/${sid}`).catch(() => undefined);
            await this.httpPost(`/vehicles/${vid}/stations`, payload).catch(() => undefined);
          });
        } else {
          await this.httpPost(`/vehicles/${vid}/stations`, payload).catch(() => undefined);
        }
      }
    }

    // 3.D) Geofence (PUT/POST /vehicles/:vid/geofence با id)
    if (snap.geofence) {
      if (snap.geofence.type === 'circle') {
        const { id, type, center, radius_m, tolerance_m, ...extras } = snap.geofence as any;
        const bodyBase = {
          id: this.num(id) ?? undefined,
          type: 'circle' as const,
          centerLat: center.lat,
          centerLng: center.lng,
          radiusM: this.toInt(radius_m, 1),
          toleranceM: this.toInt(tolerance_m ?? 15, 0),
        };
        const body = this.mergeExtrasSafe(bodyBase, extras);
        await this.httpPut(`/vehicles/${vid}/geofence`, body).catch(() =>
          this.httpPost(`/vehicles/${vid}/geofence`, body),
        );
      } else {
        const { id, type, points, tolerance_m, ...extras } = snap.geofence as any;
        const polygonPoints = (points || []).map((p: any) => {
          const { lat, lng, latitude, longitude, ...pex } = p || {};
          return this.mergeExtrasSafe({ lat: this.num(lat ?? latitude), lng: this.num(lng ?? longitude) }, pex);
        });
        const bodyBase = {
          id: this.num(id) ?? undefined,
          type: 'polygon' as const,
          polygonPoints,
          toleranceM: this.toInt(tolerance_m ?? 15, 0),
        };
        const body = this.mergeExtrasSafe(bodyBase, extras);
        await this.httpPut(`/vehicles/${vid}/geofence`, body).catch(() =>
          this.httpPost(`/vehicles/${vid}/geofence`, body),
        );
      }
    }
  }

  // ============================================================
  // 4) ایجاد و اعمال موقت + بازگشت
  // ============================================================
  // src/temporary-assignments/temporary-assignments.service.ts

  async createAndApply(dto: {
    vehicle_ids: number[];
    temp_profile: any;
    start_at?: string;          // 🔹 جدید
    duration_minutes?: number;
    until?: string;
  }) {
    const vids = (dto.vehicle_ids || []).map(Number).filter(Number.isFinite);
    if (!vids.length) throw new BadRequestException('هیچ ماشین معتبری ارسال نشده.');

    // جلوگیری از active موازی
    for (const vid of vids) {
      const actives = await this.repo.find({ where: { vehicle_id: vid, status: 'active' as any } });
      for (const a of actives) await this.cancelAndRestore(a.id);
    }

    // 🔹 زمان‌ها
    const startsAt = dto.start_at ? new Date(dto.start_at) : new Date();
    if (isNaN(+startsAt)) throw new BadRequestException('start_at نامعتبر است.');

    let endsAt: Date | null = null;
    if (dto.until) {
      endsAt = new Date(dto.until);
    } else if (Number.isFinite(Number(dto.duration_minutes))) {
      const minutes = Math.max(1, Math.trunc(Number(dto.duration_minutes)));
      endsAt = new Date(+startsAt + minutes * 60_000);
    }
    if (!endsAt || isNaN(+endsAt)) throw new BadRequestException('until/duration نامعتبر است.');

    for (const vid of vids) {
      // Snapshot قبل از اعمال
      const snap = await this.readCurrentVehicleSettings(vid);

      const rec = this.repo.create({
        vehicle_id: vid,
        temp_profile_id: Number(dto.temp_profile?.id ?? 0),
        previous_settings: snap as any,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'active', // ⬅️ طبق منطق فعلی، همین الآن اعمال می‌کنیم
      });
      await this.repo.save(rec);

      try {
        // تبدیل ورودی به Snapshot با fallback از snap برای پر کردن مقادیر غایب
        const profSnapRaw = this.normalizeIncomingProfile(dto.temp_profile, snap) as Snapshot;
        const profSnap = this.pruneNullishDeep(profSnapRaw);

        await this.clearVehicleSettings(vid);
        await this.applySnapshotExactly(vid, profSnap);
      } catch (e) {
        await this.restoreFromSnapshot(vid, snap).catch(() => undefined);
        rec.status = 'cancelled';
        rec.restored_at = new Date();
        await this.repo.save(rec);
        throw e;
      }
    }

    return { count: vids.length, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
  }

  // ============================================================
  // 5) بازگردانی
  // ============================================================
  private async restoreFromSnapshot(vid: number, snap: Snapshot): Promise<void> {
    await this.clearVehicleSettings(vid);
    await this.applySnapshotExactly(vid, this.pruneNullishDeep(snap));
  }

  async tick(): Promise<void> {
    const now = new Date();
    const due = await this.repo.find({ where: { status: 'active' as any } });
    const expired = due.filter((r) => +new Date(r.ends_at) <= +now);
    for (const rec of expired) {
      try {
        await this.restoreFromSnapshot(rec.vehicle_id, rec.previous_settings as any);
        rec.status = 'restored';
        rec.restored_at = new Date();
        await this.repo.save(rec);
      } catch { /* log if needed */ }
    }
  }
  // src/temporary-assignments/temporary-assignments.service.ts
  // ... بقیه‌ی ایمپورت‌ها و کلاس

  private async readCurrentVehicleSettings(vid: number): Promise<Snapshot> {
    let route: Snapshot['route'] = null;
    let routeId: number | null = null;
    try {
      const { data: cur, status } = await this.httpGet<any>(`/vehicles/${vid}/routes/current`);
      if (status < 400 && cur) {
        // 🔹 اینجا کلیدهای بیشتری پوشش داده می‌شود
        const ridRaw = cur?.route_id ?? cur?.id ?? cur?.route?.id ?? cur?.routeId;
        const rid = this.num(ridRaw);
        if (rid != null) {
          routeId = rid;

          const thrRaw = cur?.threshold_m ?? cur?.thresholdM ?? cur?.route?.threshold_m ?? cur?.route?.thresholdM ?? 60;
          const nameRaw = cur?.name ?? cur?.route?.name;

          route = this.normRoute({
            id: rid,
            name: nameRaw,
            threshold_m: thrRaw,
          });
        }
      }
    } catch { /* ignore */ }

    const route_stations: Snapshot['route_stations'] = [];
    if (routeId != null) {
      try {
        const { data, status } = await this.httpGet<any>(`/routes/${routeId}/stations`);
        if (status < 400) {
          const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          arr.forEach((s: any, i: number) => {
            const n = this.normStation(s, i);
            if (n) route_stations.push(n);
          });
        }
      } catch { /* ignore */ }
    }

    const vehicle_stations: Snapshot['vehicle_stations'] = [];
    try {
      const { data, status } = await this.httpGet<any>(`/vehicles/${vid}/stations`, { _: Date.now() });
      if (status < 400) {
        const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        arr.forEach((s: any, i: number) => {
          const n = this.normStation(s, i);
          if (n) vehicle_stations.push(n);
        });
      }
    } catch { /* ignore */ }

    let geofence: Snapshot['geofence'] = null;
    try {
      const { data, status } = await this.httpGet<any>(`/vehicles/${vid}/geofence`);
      if (status < 400 && data) geofence = this.normGeofence(data) as any;
    } catch { /* ignore */ }

    return { route, route_stations, vehicle_stations, geofence };
  }

  async cancelAndRestore(id: number) {
    const rec = await this.repo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('رکورد یافت نشد');
    if (rec.status !== 'active') return rec;
    await this.restoreFromSnapshot(rec.vehicle_id, rec.previous_settings as any);
    rec.status = 'restored';
    rec.restored_at = new Date();
    await this.repo.save(rec);
    return rec;
  }

  private normalizeIncomingProfile(profile: any, fallback?: Snapshot): Snapshot {
    const incoming = (profile?.settings ?? profile ?? {}) as Record<string, any>;
    const has = (k: string) => Object.prototype.hasOwnProperty.call(incoming, k);

    // FIX: اگر کلید وجود داشت، از آن استفاده کن، حتی اگر null باشد. در غیر این صورت از fallback استفاده کن.
    const route = has('route')
      ? this.normRoute(incoming.route)
      : (fallback?.route ?? null);

    const route_stations: Station[] = has('route_stations')
      ? (Array.isArray(incoming.route_stations)
        ? incoming.route_stations
          .map((s: any, i: number) => this.normStation(s, i))
          .filter(this.isNotNull)
        : []) // اگر route_stations هست ولی آرایه نیست، خالی در نظر بگیر
      : (fallback?.route_stations ?? []);

    // FIX: نام 'stations' در ورودی به 'vehicle_stations' در اسنپ‌شات مپ می‌شود
    const vehicle_stations: Station[] = has('stations')
      ? (Array.isArray(incoming.stations)
        ? incoming.stations
          .map((s: any, i: number) => this.normStation(s, i))
          .filter(this.isNotNull)
        : []) // اگر stations هست ولی آرایه نیست، خالی در نظر بگیر
      : (fallback?.vehicle_stations ?? []);

    // FIX: منطق کلیدی برای ژئوفنس
    const geofence = has('geofence')
      ? this.normGeofence(incoming.geofence) // اگر فرانت geofence را فرستاده (حتی null)، همان را نرمالایز کن
      : (fallback?.geofence ?? null);      // در غیر این صورت از fallback استفاده کن

    return { route, route_stations, vehicle_stations, geofence };
  }

  // یک type-guard عمومی اضافه کن داخل کلاس
  private isNotNull<T>(v: T | null | undefined): v is T {
    return v != null;
  }

}
// بالای فایل، کنار type AnyRec
type Station = {
  id?: number;
  name?: string;
  lat: number;
  lng: number;
  radius_m?: number;
  order_no?: number;
  [k: string]: any;
};

// Snapshot را به Station[] آپدیت کن
type Snapshot = {
  route: { id?: number; name?: string; threshold_m?: number } | null;
  route_stations: Station[];
  vehicle_stations: Station[];
  geofence:
  | { id?: number; type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number;[k: string]: any }
  | { id?: number; type: 'polygon'; points: Array<{ lat: number; lng: number;[k: string]: any }>; tolerance_m?: number;[k: string]: any }
  | null;
};

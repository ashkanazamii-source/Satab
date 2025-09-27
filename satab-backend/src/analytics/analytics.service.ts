import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Users } from '../users/users.entity';
import { UserService } from '../users/users.service';
import { UserLevel } from '../entities/role.entity';
import { getDistance } from 'geolib';

type Summary = {
  drivers: number;
  totalDistanceKm: number;
  engineHours: number;
  totalViolations: number; // فعلاً 0 چون جدول تخلف نداری
};
// داخل AnalyticsService (کنار سایر typeها)
type ViolationCounts = { total: number; byType: Record<string, number> };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly usersService: UserService,
  ) { }
  // داخل AnalyticsService (مثلاً بعد از parseJsonMaybe)
  private async countViolationsForDrivers(
    driverIds: number[],
    from: Date,
    to: Date,
    types?: string[],
  ): Promise<ViolationCounts> {
    if (!driverIds.length) return { total: 0, byType: {} };

    // از meta.at اگر وجود داشت استفاده می‌کنیم، وگرنه created_at
    let sql = `
    SELECT type, COUNT(*)::int AS c
      FROM violations
     WHERE driver_user_id = ANY($1)
       AND COALESCE((meta->>'at')::timestamptz, created_at) BETWEEN $2 AND $3
  `;
    const params: any[] = [driverIds, from, to];

    if (Array.isArray(types) && types.length) {
      sql += ` AND type = ANY($4)`;
      params.push(types);
    }
    sql += ` GROUP BY type`;

    const rows = await this.ds.query(sql, params);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const t = String(r.type ?? 'unknown');
      const c = Number(r.c ?? 0);
      byType[t] = c;
      total += c;
    }
    return { total, byType };
  }

  private distanceKmFromPoints(raw: any[]): number {
    if (!Array.isArray(raw) || raw.length < 2) return 0;

    // نرمال‌سازی و سورت زمانی
    const pts = raw
      .map(p => ({
        lat: Number(p?.lat ?? p?.latitude),
        lng: Number(p?.lng ?? p?.longitude),
        t: p?.timestamp ? new Date(p.timestamp).getTime()
          : (p?.ts ? new Date(p.ts).getTime() : undefined),
      }))
      .filter(p =>
        Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
        p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180 &&
        !(p.lat === 0 && p.lng === 0)
      )
      .sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

    let totalM = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = getDistance({ latitude: a.lat, longitude: a.lng }, { latitude: b.lat, longitude: b.lng });
      const dt = (a.t != null && b.t != null) ? Math.max(1, (b.t - a.t) / 1000) : null;

      // فیلتر نویز/پرش
      if (d < 3) continue;                // نویز
      if (dt != null && d / dt > 60) continue; // سرعت غیرواقعی
      if (dt == null && d > 1000) continue;  // پرش بدون زمان

      totalM += d;
    }
    return totalM / 1000;
  }
  /** همهٔ آی‌دی‌های زیرشاخهٔ یک کاربر (خودش هم شامل) با CTE بازگشتی */
  private async getSubtreeUserIds(rootUserId: number): Promise<number[]> {
    const rows = await this.ds.query(
      `
      WITH RECURSIVE sub AS (
        SELECT id FROM users WHERE id = $1
        UNION ALL
        SELECT u.id
        FROM users u
        JOIN sub s ON u.parent_id = s.id
      )
      SELECT id FROM sub
      `,
      [rootUserId],
    );
    return rows.map((r: any) => Number(r.id));
  }

  /** چک دسترسی: target باید داخل زیردرخت me باشد (یا خودش) */
  private async assertAccessible(meId: number, targetId: number) {
    if (meId === targetId) return;
    const ids = await this.getSubtreeUserIds(meId);
    if (!ids.includes(targetId)) throw new ForbiddenException('No access to this node');
  }
  // داخل کلاس AnalyticsService

  private parseJsonMaybe(v: any) {
    if (v == null) return null;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    if (Array.isArray(v) || typeof v === 'object') return v;
    return null;
  }

  private pickLastByTs<T extends { ts?: any }>(arr: T[] | null | undefined): T | null {
    if (!Array.isArray(arr) || !arr.length) return null;
    const norm = arr
      .map(e => ({ ...e, _t: e?.ts ? new Date(e.ts).getTime() : -1 }))
      .filter(e => Number.isFinite(e._t) && e._t >= 0)
      .sort((a, b) => a._t - b._t);
    const last = norm[norm.length - 1];
    if (!last) return null;
    delete (last as any)._t;
    return last as T;
  }

  /** آخرین Route که با بازه هم‌پوشانی دارد (یا نزدیک‌ترین فعال) + بستهٔ تله‌متری برای راننده */
  private async getDriverTelemetryPayload(
    driverId: number,
    from: Date,
    to: Date,
    limits = { maxPoints: 500, maxEvents: 200 }
  ) {
    // Route ای که با بازه همپوشانی دارد را بگیر
    const rows = await this.ds.query(
      `
    SELECT id, status, started_at, finished_at,
           last_lat, last_lng, last_point_ts,
           gps_points, telemetry_events
      FROM driver_routes
     WHERE driver_id = $1
       AND started_at <= $2
       AND (finished_at IS NULL OR finished_at >= $3)
     ORDER BY started_at DESC
     LIMIT 1
    `,
      [driverId, to, from]
    );

    // اگر چیزی نبود، آخرین Routeِ راننده را بگیر (برای نمایش وضعیت جاری)
    const route = rows[0] ?? (await this.ds.query(
      `
    SELECT id, status, started_at, finished_at,
           last_lat, last_lng, last_point_ts,
           gps_points, telemetry_events
      FROM driver_routes
     WHERE driver_id = $1
     ORDER BY started_at DESC
     LIMIT 1
    `,
      [driverId]
    ))[0];

    if (!route) return null;

    const gpsRaw = this.parseJsonMaybe(route.gps_points) || [];
    const evRaw = this.parseJsonMaybe(route.telemetry_events) || [];

    // نقاط و ایونت‌ها را به آخرین N تا محدود کن
    const points = Array.isArray(gpsRaw) ? gpsRaw.slice(-Math.max(1, limits.maxPoints)) : [];
    const events = Array.isArray(evRaw) ? evRaw.slice(-Math.max(1, limits.maxEvents)) : [];

    const lastEvent = this.pickLastByTs(events);
    const lastPoint = route.last_lat != null && route.last_lng != null
      ? { lat: Number(route.last_lat), lng: Number(route.last_lng), ts: route.last_point_ts ?? null }
      : (points.length ? { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng, ts: points[points.length - 1].timestamp ?? null } : null);

    return {
      routeId: Number(route.id),
      status: String(route.status),
      started_at: route.started_at,
      finished_at: route.finished_at,
      lastPoint,
      lastEvent,
      points,
      events,
    };
  }

  private async aggregateSubtree(rootId: number, from: Date, to: Date): Promise<Summary> {
    // آی‌دیِ رانندگانِ زیردرخت
    const idsRows = await this.ds.query(`
    WITH RECURSIVE sub AS (
      SELECT id, role_level FROM users WHERE id = $1
      UNION ALL
      SELECT u.id, u.role_level FROM users u JOIN sub s ON u.parent_id = s.id
    )
    SELECT id FROM sub WHERE role_level = $2
  `, [rootId, UserLevel.DRIVER]);

    const driverIds = idsRows.map((r: any) => Number(r.id));
    if (!driverIds.length) {
      return { drivers: 0, totalDistanceKm: 0, engineHours: 0, totalViolations: 0 };
    }

    // همه‌ی routeهای بازه برای این راننده‌ها
    const routes = await this.ds.query(
      `SELECT gps_points, started_at, finished_at
       FROM driver_routes
      WHERE driver_id = ANY($1)
        AND started_at BETWEEN $2 AND $3`,
      [driverIds, from, to]
    );
    const vio = await this.countViolationsForDrivers(driverIds, from, to);

    // جمع دقیق
    let km = 0, hours = 0;
    for (const r of routes) {
      const pts = this.parseJsonMaybe(r.gps_points) || [];
      km += this.distanceKmFromPoints(pts);
      const st = r.started_at ? new Date(r.started_at).getTime() : NaN;
      const en = r.finished_at ? new Date(r.finished_at).getTime() : NaN;
      if (Number.isFinite(st) && Number.isFinite(en) && en >= st) {
        hours += (en - st) / 3600_000;
      }
    }

    return {
      drivers: driverIds.length,           // تعداد DISTINCT راننده‌ها
      totalDistanceKm: +km.toFixed(3),
      engineHours: +hours.toFixed(3),
      totalViolations: vio.total,
    };
  }


  /** خلاصهٔ یک یوزر: اگر راننده باشد مستقیم؛ وگرنه جمع زیردرخت خودش */
  private async summarizeUser(userId: number, from: Date, to: Date): Promise<Summary> {
    const u = await this.ds.getRepository(Users).findOne({ where: { id: userId } });
    if (!u) return { drivers: 0, totalDistanceKm: 0, engineHours: 0, totalViolations: 0 };
    const vio = await this.countViolationsForDrivers([userId], from, to);

    if (u.role_level === UserLevel.DRIVER) {
      // همه‌ی routeهای بازه را بگیر (فقط فیلدهای لازم)
      const rows = await this.ds.query(
        `SELECT gps_points, started_at, finished_at
       FROM driver_routes
      WHERE driver_id = $1
        AND started_at BETWEEN $2 AND $3`,
        [userId, from, to],
      );

      // JSON → Array و جمع دقیق
      let km = 0, hours = 0;
      for (const r of rows) {
        const pts = this.parseJsonMaybe(r.gps_points) || [];
        km += this.distanceKmFromPoints(pts);
        const st = r.started_at ? new Date(r.started_at).getTime() : NaN;
        const en = r.finished_at ? new Date(r.finished_at).getTime() : NaN;
        if (Number.isFinite(st) && Number.isFinite(en) && en >= st) {
          hours += (en - st) / 3600_000;
        }
      }

      return {
        drivers: 1,
        totalDistanceKm: +km.toFixed(3),
        engineHours: +hours.toFixed(3),
        totalViolations: vio.total,
      };
    }

    return this.aggregateSubtree(userId, from, to);
  }

  /**
   * خروجی: { range, node: { id, full_name, role_level, summary, children:[{...}] } }
   * children فقط «زیرمجموعه‌های مستقیم» هستند و هر کدام summary و hasChildren دارند.
   */
  async getTree(me: Users, userId: number | undefined, from: Date, to: Date) {
    const targetId = userId ?? me.id;
    await this.assertAccessible(me.id, targetId);

    const target = await this.ds.getRepository(Users).findOne({
      where: { id: targetId },
      select: ['id', 'full_name', 'role_level'] as any,
    });
    if (!target) return null;

    const targetSummary = await this.aggregateSubtree(targetId, from, to);

    const children = await this.ds.getRepository(Users).find({
      where: { parent: { id: targetId } },
      select: ['id', 'full_name', 'role_level'] as any,
      order: { full_name: 'ASC' as any },
    });

    const childrenWithSummary = await Promise.all(
      children.map(async (c) => {
        const countRow = await this.ds.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE parent_id = $1`,
          [c.id],
        );
        const s = await this.summarizeUser(c.id, from, to);
        return {
          id: c.id,
          full_name: c.full_name,
          role_level: c.role_level,
          summary: s,
          hasChildren: Number(countRow[0]?.count ?? 0) > 0,
        };
      }),
    );

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      node: {
        id: target.id,
        full_name: target.full_name,
        role_level: target.role_level,
        summary: targetSummary,
        children: childrenWithSummary,
      },
    };
  }

  /** فقط کارت‌های یک نود (جمع زیردرخت) */
  async getNodeSummary(me: Users, userId: number | undefined, from: Date, to: Date, p0: { includeTelemetry: boolean; limits: { maxPoints: number; maxEvents: number; }; }) {
    const targetId = userId ?? me.id;
    await this.assertAccessible(me.id, targetId);

    // خلاصه‌ی موجود (مثل قبل)
    const s = await this.aggregateSubtree(targetId, from, to);

    // اگر هدف «راننده» است، تله‌متری آخرین Route را هم ضمیمه کن
    const u = await this.ds.getRepository(Users).findOne({ where: { id: targetId }, select: ['id', 'role_level'] as any });
    let telemetry: any = null;
    if (u && u.role_level === UserLevel.DRIVER) {
      telemetry = await this.getDriverTelemetryPayload(targetId, from, to, { maxPoints: 500, maxEvents: 200 });
    }

    return { nodeId: targetId, ...s, ...(telemetry ? { telemetry } : {}) };
  }

  // + اضافه کن داخل AnalyticsService
  async getDashboard(
    me: Users,
    userId: number | undefined,
    bucket: 'day' | 'week' | 'month',
    from: Date,
    to: Date,
  ) {
    // از همون لاجیک دسترسی و خلاصهٔ فعلی استفاده کن
    const tree = await this.getTree(me, userId, from, to);
    if (!tree?.node) return null;

    const { node } = tree;
    const children = node.children ?? [];

    // ---------- datasets مورد نیاز فرانت ----------
    const childBar = children.map((c: any) => ({
      id: c.id,
      role: c.role_level,
      name: c.full_name,
      km: Number(c.summary?.totalDistanceKm ?? 0),
      hours: Number(c.summary?.engineHours ?? 0),
      drivers: Number(c.summary?.drivers ?? (c.role_level === 6 ? 1 : 0)),
      violations: Number(c.summary?.totalViolations ?? 0),
    }));

    const pieKm = childBar.map(d => ({ name: d.name, value: d.km }));
    const pieHours = childBar.map(d => ({ name: d.name, value: d.hours }));

    // تفکیک نقش‌ها بین زیرمجموعه‌های مستقیم
    const roleMap: Record<number, number> = {};
    for (const c of children) roleMap[c.role_level] = (roleMap[c.role_level] ?? 0) + 1;
    const roleRadial = Object.entries(roleMap).map(([lvl, count]) => ({
      name: ({ 1: 'مدیرکل', 2: 'سوپرادمین', 3: 'مدیر شعبه', 4: 'مالک', 5: 'تکنسین', 6: 'راننده' } as any)[Number(lvl)] ?? 'نامشخص',
      count: Number(count),
    }));

    // Radar (top by km، نرمالایز)
    const topByKm = [...childBar].sort((a, b) => b.km - a.km).slice(0, 6);
    const maxKm = Math.max(1, ...topByKm.map(d => d.km));
    const maxHours = Math.max(1, ...topByKm.map(d => d.hours));
    const maxDrivers = Math.max(1, ...topByKm.map(d => d.drivers));
    const radarData = topByKm.map(d => ({
      subject: d.name,
      kmPct: +(100 * d.km / maxKm).toFixed(1),
      hoursPct: +(100 * d.hours / maxHours).toFixed(1),
      driversPct: +(100 * d.drivers / maxDrivers).toFixed(1),
    }));

    // Scatter و Treemap
    const scatterData = childBar.map(d => ({ x: d.km, y: d.hours, z: Math.max(1, d.drivers), name: d.name }));
    const treeMapData = childBar.map(d => ({ name: d.name, size: Math.max(0, d.km) }));

    // ---------- سری زمانی (trend) ----------
    const unit =
      bucket === 'day' ? 'hour' :
        bucket === 'week' ? 'day' :
          'day'; // برای month هم day
    const targetId = userId ?? me.id;
    await this.assertAccessible(me.id, targetId);

    const trendRows = await this.ds.query(`
    WITH RECURSIVE sub AS (
      SELECT id FROM users WHERE id = $1
      UNION ALL
      SELECT u.id FROM users u JOIN sub s ON u.parent_id = s.id
    )
    SELECT
      date_trunc('${unit}', dr.started_at) AS bucket,
      COALESCE(SUM(dr.total_distance_km), 0)::float AS km,
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(dr.finished_at, now()) - dr.started_at)))/3600, 0)::float AS hours
    FROM sub s
    LEFT JOIN driver_routes dr
      ON dr.driver_id = s.id
     AND dr.started_at BETWEEN $2 AND $3
    GROUP BY 1
    ORDER BY 1
  `, [targetId, from, to]);

    return {
      range: tree.range,
      node: { id: node.id, full_name: node.full_name, role_level: node.role_level },
      summary: node.summary,        // کارت‌ها
      children: node.children,      // جدول زیرمجموعه‌های مستقیم
      charts: {
        childBar,
        pieKm,
        pieHours,
        radarData,
        roleRadial,
        scatterData,
        treeMapData,
      },
      trend: {
        bucket,
        buckets: trendRows, // [{bucket, km, hours}, ...]
      },
    };
  }

}

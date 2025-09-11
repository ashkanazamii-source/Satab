import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Users } from '../users/users.entity';
import { UserService } from '../users/users.service';
import { UserLevel } from '../entities/role.entity';

type Summary = {
  drivers: number;
  totalDistanceKm: number;
  engineHours: number;
  totalViolations: number; // فعلاً 0 چون جدول تخلف نداری
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly usersService: UserService,
  ) { }

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

  /** جمع کل برای «تمام راننده‌های» زیردرخت rootId در بازه */
  private async aggregateSubtree(rootId: number, from: Date, to: Date): Promise<Summary> {
    const rows = await this.ds.query(
      `
      WITH RECURSIVE sub AS (
        SELECT id, role_level FROM users WHERE id = $1
        UNION ALL
        SELECT u.id, u.role_level
        FROM users u
        JOIN sub s ON u.parent_id = s.id
      )
      SELECT
        COUNT(*) FILTER (WHERE role_level = $4)::int                               AS drivers,
        COALESCE(SUM(dr.total_distance_km), 0)::float                               AS total_km,
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(dr.finished_at, now()) - dr.started_at)))/3600, 0)::float
                                                                                   AS engine_hours
      FROM sub s
      LEFT JOIN driver_routes dr
        ON dr.driver_id = s.id
       AND dr.started_at BETWEEN $2 AND $3
      `,
      [rootId, from, to, UserLevel.DRIVER],
    );

    return {
      drivers: Number(rows[0]?.drivers ?? 0),
      totalDistanceKm: Number(rows[0]?.total_km ?? 0),
      engineHours: Number(rows[0]?.engine_hours ?? 0),
      totalViolations: 0,
    };
  }

  /** خلاصهٔ یک یوزر: اگر راننده باشد مستقیم؛ وگرنه جمع زیردرخت خودش */
  private async summarizeUser(userId: number, from: Date, to: Date): Promise<Summary> {
    const u = await this.ds.getRepository(Users).findOne({ where: { id: userId } });
    if (!u) return { drivers: 0, totalDistanceKm: 0, engineHours: 0, totalViolations: 0 };

    if (u.role_level === UserLevel.DRIVER) {
      const rows = await this.ds.query(
        `
        SELECT
          COALESCE(SUM(total_distance_km), 0)::float AS total_km,
          COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at)))/3600, 0)::float
            AS engine_hours
        FROM driver_routes
        WHERE driver_id = $1
          AND started_at BETWEEN $2 AND $3
        `,
        [userId, from, to],
      );
      return {
        drivers: 1,
        totalDistanceKm: Number(rows[0]?.total_km ?? 0),
        engineHours: Number(rows[0]?.engine_hours ?? 0),
        totalViolations: 0,
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
  async getNodeSummary(me: Users, userId: number | undefined, from: Date, to: Date) {
    const targetId = userId ?? me.id;
    await this.assertAccessible(me.id, targetId);
    const s = await this.aggregateSubtree(targetId, from, to);
    return { nodeId: targetId, ...s };
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

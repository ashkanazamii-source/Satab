// vehicle-policies.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  VehiclePolicy,
  VehicleTypeCode,
  MonitorKey,
} from './vehicle-policy.entity';
import {
  UpdateVehiclePoliciesDto,
  SetBoundedVehiclePoliciesDto,
} from '../dto/update-vehicle-policies.dto';
import { Users } from '../users/users.entity';
import { AuditService } from '../audit/audit.service';
import { AuditTopic } from '../audit/audit-topics';

type PolicyDiff = {
  code: VehicleTypeCode;
  granted: MonitorKey[];
  revoked: MonitorKey[];
  allowedFrom: boolean;
  allowedTo: boolean;
  maxFrom: number;
  maxTo: number;
};

@Injectable()
export class VehiclePoliciesService {
  constructor(
    @InjectRepository(VehiclePolicy)
    private readonly repo: Repository<VehiclePolicy>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    private readonly audit: AuditService,
  ) {}

  /** همهٔ سیاست‌ها برای یک کاربر (اختیاری فقط Allowed) */
  async getForUser(userId: number, onlyAllowed = false): Promise<VehiclePolicy[]> {
    const rows = await this.repo.find({ where: { user_id: userId } });
    return onlyAllowed ? rows.filter((r) => r.is_allowed) : rows;
  }

  /** لیست کُدِ تایپ‌های مجاز برای کاربر */
  async getAllowedVehicleTypeCodes(userId: number): Promise<VehicleTypeCode[]> {
    const rows = await this.getForUser(userId, true);
    return rows.map((r) => r.vehicle_type_code);
  }

  /** مپِ vehicle_type_code => monitor_params (فقط Allowedها) */
  async getAllowedMonitorMap(
    userId: number,
  ): Promise<Record<VehicleTypeCode, MonitorKey[]>> {
    const rows = await this.getForUser(userId, true);
    const out: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
    rows.forEach((r) => {
      out[r.vehicle_type_code] = Array.isArray(r.monitor_params)
        ? r.monitor_params
        : [];
    });
    return out;
  }

  /** اجتماع همهٔ مانیتورها روی همهٔ تایپ‌های Allowed */
  async getAllowedMonitorUnion(userId: number): Promise<MonitorKey[]> {
    const rows = await this.getForUser(userId, true);
    const s = new Set<MonitorKey>();
    rows.forEach((r) => (r.monitor_params || []).forEach((m) => s.add(m)));
    return Array.from(s);
  }

  /** کمک‌متد: دیف آرایه‌ی مانیتورها */
  private diffMonitors(before: MonitorKey[] = [], after: MonitorKey[] = []) {
    const B = new Set(before);
    const A = new Set(after);
    return {
      granted: [...A].filter((x) => !B.has(x)),
      revoked:  [...B].filter((x) => !A.has(x)),
    };
  }

  /** کمک‌متد: لاگ‌نویسی استاندارد */
  private async logPolicyUpdate(
    actorUserId: number | undefined,
    targetUserId: number,
    d: PolicyDiff,
  ) {
    const parts: string[] = [];
    if (d.granted.length) parts.push(`داد: ${d.granted.join('، ')}`);
    if (d.revoked.length) parts.push(`گرفت: ${d.revoked.join('، ')}`);
    if (!parts.length && d.allowedFrom !== d.allowedTo) {
      parts.push(d.allowedTo ? 'فعال شد' : 'غیرفعال شد');
    }
    if (d.maxFrom !== d.maxTo) {
      parts.push(`سقف از ${d.maxFrom} به ${d.maxTo} تغییر کرد`);
    }

    const message = `واگذاری دسترسی مانیتورینگ (${d.code}) — ${parts.join(' — ')}`.trim();

    await this.audit.log({
      topic: AuditTopic.POLICY_UPDATE,
      actor_id: actorUserId ?? null,
      target_user_id: targetUserId,
      message,
      metadata: {
        vehicle_type_code: d.code,
        granted: d.granted,
        revoked: d.revoked,
        allowed_from: d.allowedFrom,
        allowed_to: d.allowedTo,
        max_from: d.maxFrom,
        max_to: d.maxTo,
      },
    });
  }

  /**
   * آپسرت سیاست‌های وسیله برای کاربر (فقط روی کدهای ارسالی).
   * خروجی: فقط Allowedهای فعلی بعد از ذخیره.
   */
  async upsertForUser(
    userId: number,
    dto: UpdateVehiclePoliciesDto,
    actorUserId?: number, // برای لاگ
  ): Promise<VehiclePolicy[]> {
    if (!dto?.policies?.length) {
      return this.getForUser(userId, true);
    }

    const codes = dto.policies.map((p) => p.vehicle_type_code);
    const existing = await this.repo.find({
      where: { user_id: userId, vehicle_type_code: In(codes) },
    });
    const byCode = new Map(existing.map((e) => [e.vehicle_type_code, e]));

    const toSave: VehiclePolicy[] = [];
    const diffs: PolicyDiff[] = [];

    for (const p of dto.policies) {
      const row =
        byCode.get(p.vehicle_type_code) ??
        this.repo.create({
          user_id: userId,
          vehicle_type_code: p.vehicle_type_code,
        });

      const beforeAllowed = !!row.is_allowed;
      const beforeMax = row.max_count ?? 0;
      const beforeMon = Array.isArray(row.monitor_params) ? row.monitor_params : [];

      row.is_allowed = !!p.is_allowed;
      row.max_count = Number.isFinite(+p.max_count) ? Math.max(0, +p.max_count) : 0;
      row.monitor_params = Array.isArray(p.monitor_params)
        ? (p.monitor_params as MonitorKey[]).filter(Boolean)
        : [];

      const { granted, revoked } = this.diffMonitors(beforeMon, row.monitor_params);

      if (
        granted.length || revoked.length ||
        beforeAllowed !== row.is_allowed ||
        beforeMax !== row.max_count
      ) {
        diffs.push({
          code: p.vehicle_type_code,
          granted,
          revoked,
          allowedFrom: beforeAllowed,
          allowedTo: row.is_allowed,
          maxFrom: beforeMax,
          maxTo: row.max_count,
        });
      }

      toSave.push(row);
    }

    if (toSave.length) await this.repo.save(toSave);
    if (diffs.length) {
      await Promise.all(diffs.map((d) => this.logPolicyUpdate(actorUserId, userId, d)));
    }

    return this.getForUser(userId, true);
  }

  /** حذف سیاست یک تایپ خاص برای کاربر */
  async removeOne(
    userId: number,
    vehicleType: VehicleTypeCode,
  ): Promise<{ success: boolean }> {
    await this.repo.delete({ user_id: userId, vehicle_type_code: vehicleType });
    return { success: true };
  }

  /** گرفتن یک ردیف خاص (برای دیباگ/نمایش) */
  async getOne(
    userId: number,
    vehicleType: VehicleTypeCode,
  ): Promise<VehiclePolicy> {
    const row = await this.repo.findOne({
      where: { user_id: userId, vehicle_type_code: vehicleType },
    });
    if (!row) throw new NotFoundException('Policy not found');
    return row;
  }

  /** چیزهایی که کاربر فعلی می‌تواند واگذار کند (Allowedهای خودش) */
  async getGrantableForUser(userId: number): Promise<VehiclePolicy[]> {
    return this.getForUser(userId, true);
  }

  /**
   * واگذاری محدود از granter → target
   */
  async updatePoliciesBounded(
    granterUserId: number,
    targetUserId: number,
    dto: SetBoundedVehiclePoliciesDto,
  ): Promise<VehiclePolicy[]> {
    if (!dto?.policies) dto = { policies: [] };

    const [granter, target] = await Promise.all([
      this.usersRepo.findOne({ where: { id: granterUserId }, select: { id: true } }),
      this.usersRepo.findOne({ where: { id: targetUserId }, select: { id: true } }),
    ]);
    if (!granter || !target) throw new NotFoundException('User not found');

    if (!(await this.isDescendantOf(granter.id, target.id))) {
      throw new ForbiddenException('کاربر هدف در زیرمجموعهٔ شما نیست');
    }

    const grantable = await this.getForUser(granterUserId, true);
    const grantableByType = new Map(grantable.map((r) => [r.vehicle_type_code, r]));

    const codes = dto.policies.map((p) => p.vehicle_type_code);
    const existingTarget = await this.repo.find({
      where: { user_id: targetUserId, vehicle_type_code: In(codes) },
    });
    const targetByType = new Map(existingTarget.map((r) => [r.vehicle_type_code, r]));

    const toSave: VehiclePolicy[] = [];
    const diffs: PolicyDiff[] = [];

    for (const p of dto.policies) {
      const g = grantableByType.get(p.vehicle_type_code);
      if (!g) continue; // واگذارکننده این تایپ را ندارد

      const reqSet = new Set<MonitorKey>(
        Array.isArray(p.monitor_params) ? (p.monitor_params as MonitorKey[]) : [],
      );
      const granterSet = new Set<MonitorKey>(g.monitor_params || []);

      const boundedMonitors: MonitorKey[] = [];
      reqSet.forEach((m) => granterSet.has(m) && boundedMonitors.push(m));

      const prev = targetByType.get(p.vehicle_type_code);
      const row =
        prev ??
        this.repo.create({
          user_id: targetUserId,
          vehicle_type_code: p.vehicle_type_code,
        });

      const beforeAllowed = !!row.is_allowed;
      const beforeMax = row.max_count ?? 0;
      const beforeMon = Array.isArray(row.monitor_params) ? row.monitor_params : [];

      row.is_allowed = (typeof p.is_allowed === 'boolean' ? p.is_allowed : true) && boundedMonitors.length > 0;
      row.max_count = Math.min(prev?.max_count ?? 0, g.max_count || 0);
      row.monitor_params = boundedMonitors;

      const { granted, revoked } = this.diffMonitors(beforeMon, row.monitor_params);

      if (
        granted.length || revoked.length ||
        beforeAllowed !== row.is_allowed ||
        beforeMax !== row.max_count
      ) {
        diffs.push({
          code: p.vehicle_type_code,
          granted,
          revoked,
          allowedFrom: beforeAllowed,
          allowedTo: row.is_allowed,
          maxFrom: beforeMax,
          maxTo: row.max_count,
        });
      }

      toSave.push(row);
    }

    if (toSave.length) await this.repo.save(toSave);
    if (diffs.length) {
      await Promise.all(diffs.map((d) => this.logPolicyUpdate(granterUserId, targetUserId, d)));
    }

    return this.getForUser(targetUserId, true);
  }

  /** آیا target در زنجیره‌ی owner زیرمجموعه‌ی ancestor است؟ */
  private async isDescendantOf(ancestorId: number, targetId: number): Promise<boolean> {
    if (ancestorId === targetId) return true;

    type U = { id: number; parent?: { id: number } | null };

    let current = (await this.usersRepo.findOne({
      where: { id: targetId },
      relations: ['parent'],
      select: { id: true },
    })) as U | null;

    const seen = new Set<number>();

    while (current?.parent) {
      const pid = current.parent.id;
      if (pid === ancestorId) return true;
      if (seen.has(pid)) break;
      seen.add(pid);

      current = (await this.usersRepo.findOne({
        where: { id: pid },
        relations: ['parent'],
        select: { id: true },
      })) as U | null;
    }
    return false;
  }
}

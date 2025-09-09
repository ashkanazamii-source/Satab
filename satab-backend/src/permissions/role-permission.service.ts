import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { Users } from '../users/users.entity';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';
import { UserLevel } from '../entities/role.entity'; // فرض: enum سطح نقش‌ها اینجاست
import { In } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { AuditTopic } from '../audit/audit-topics'

// اکشن‌های اصلی
const ALL_ACTIONS = [
  'create_user',
  'grant_sub_permissions',
  'view_transaction',
  'view_report',
  'control_device_remotely',
  'report_device_fault',
  'chat',
  'track_driver',
  'view_logs',
] as const;

const TRACK_CHILDREN: ReadonlyArray<string> = [
  'gps',
  'ignition',
  'idle_time',
  'odometer',
  'geo_fence',
  'stations',
  'routes',
  'consumables',
];

@Injectable()
export class RolePermissionService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    @InjectRepository(VehiclePolicy)
    private readonly vehiclePolicyRepo: Repository<VehiclePolicy>,
    private readonly audit: AuditService,
  ) { }

  // ---- Helpers ----
  private async getUserLevel(u?: Users | null): Promise<number | undefined> {
    if (!u?.id) return undefined;

    const row = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.role', 'r')
      .where('u.id = :id', { id: u.id })
      .select('r.level', 'level')
      .getRawOne<{ level: number }>();

    return row?.level ?? undefined;
  }

  private async writeAudit(opts: {
    topic: AuditTopic;                           // مثلا AuditTopic.PERMISSION_UPDATE
    actorId?: number | null;
    targetUserId?: number | null;
    message: string;
    metadata?: Record<string, any> | null;
  }) {
    try {
      await this.audit.log({
        topic: opts.topic,
        actor_id: opts.actorId ?? null,          // 👈 مپ به ورودی سرویس لاگ
        target_user_id: opts.targetUserId ?? null,
        message: opts.message,
        metadata: opts.metadata ?? null,
      });
    } catch {
      /* لاگ‌نویسی نباید منطق اصلی را بشکند */
    }
  }


  private async isDescendantOf(ancestorId: number, targetId: number): Promise<boolean> {
    if (ancestorId === targetId) return false; // ✅ خودویرایش مجاز نیست
    let current = await this.userRepo.findOne({ where: { id: targetId }, relations: ['parent'] });
    const seen = new Set<number>();
    while (current?.parent) {
      const p = current.parent as Users;
      if (p.id === ancestorId) return true;
      if (seen.has(p.id)) break;
      seen.add(p.id);
      current = await this.userRepo.findOne({ where: { id: p.id }, relations: ['parent'] });
    }
    return false;
  }

  private async getTrackDriverChildWhitelistForUser(userId: number): Promise<Set<string>> {
    // فقط پالیسی‌هایی که is_allowed=true هستند، مانیتورهای‌شون به‌عنوان وایت‌لیست مجاز می‌شوند
    const rows = await this.vehiclePolicyRepo.find({
      where: { user: { id: userId }, is_allowed: true },
      relations: ['user'],
    });

    const out = new Set<string>();
    for (const r of rows) {
      const arr = Array.isArray((r as any).monitor_params) ? (r as any).monitor_params : [];
      for (const key of arr) {
        if (TRACK_CHILDREN.includes(key)) out.add(key);
      }
    }
    return out;
  }

  private async expandGrantableForUser(
    base: Set<string>,
    userId: number,
    isManager: boolean,
  ): Promise<Set<string>> {
    const out = new Set(base);
    if (base.has('track_driver')) {
      if (isManager) {
        // مدیرکل: همه‌ی ریزها
        for (const ch of TRACK_CHILDREN) out.add(ch);
      } else {
        // SA: فقط ریزهایی که با VehiclePolicy برای خودش Allowed شده
        const whitelist = await this.getTrackDriverChildWhitelistForUser(userId);
        for (const ch of whitelist) out.add(ch);
      }
    }
    return out;
  }

  // ---- CRUD/Queries ----
  async getByUserId(userId: number) {
    return this.rolePermissionRepo.find({
      where: { user: { id: userId } },
    });
  }

  // فیلتر بر اساس سطح نقش هدف (role.level)
  async getByLevels(_granterLevel: number, targetLevel: number) {
    // اگر لازم شد granterLevel هم در شرط بیاد، می‌تونی اضافه کنی
    return this.rolePermissionRepo
      .createQueryBuilder('rp')
      .leftJoinAndSelect('rp.user', 'u')
      .leftJoinAndSelect('u.role', 'r')
      .where('r.level = :lvl', { lvl: targetLevel })
      .getMany();
  }

  async updateUserById(
    id: number,
    body: {
      full_name?: string;
      phone?: string;
      // فیلدهای ناموجود در Users حذف شدند (max_devices/max_drivers نداریم)
      // اگر لازم شد، اینجا اضافه‌شون کن وقتی به انتیتی اضافه دادی.
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');

    if (body.full_name !== undefined) user.full_name = body.full_name;
    if (body.phone !== undefined) user.phone = body.phone;

    return this.userRepo.save(user);
  }

  // ساخت اکشن‌های پیش‌فرض برای همه‌ی SAها (role.level = 2)
  async seedPermissionsForExistingSuperAdmins(actorUserId?: number) {
    let totalCreated = 0
    const superAdmins = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .where('r.level = :lvl', { lvl: UserLevel.SUPER_ADMIN })
      .getMany();

    const actions = [...ALL_ACTIONS];

    for (const user of superAdmins) {
      const existingPermissions = await this.rolePermissionRepo.find({
        where: { user: { id: user.id } },
      });

      const existingActions = existingPermissions.map(p => p.action);
      const missing = actions
        .filter(action => !existingActions.includes(action))
        .map(action =>
          this.rolePermissionRepo.create({
            user,
            action,
            is_allowed: false,
          }),
        );

      if (missing.length) {
        await this.rolePermissionRepo.save(missing);
        totalCreated += missing.length;
        console.log(`✅ ایجاد شد: ${missing.length} مجوز برای ${user.full_name}`);
      } else {
        console.log(`🔹 ${user.full_name} همه مجوزها را دارد`);
      }
    }

    await this.writeAudit({
      topic: AuditTopic.PERMISSION_SYNC,
      actorId: actorUserId,
      message: 'سید مجوزهای پیش‌فرض SA',
      metadata: { totalCreated, countUsers: superAdmins.length },
    });
    return { success: true, totalCreated };
  }

  async updatePermissionsForUserBounded(
    granterUserId: number,
    targetUserId: number,
    incoming: { action: string; is_allowed: boolean }[],
  ) {
    const granter = await this.userRepo.findOne({ where: { id: granterUserId }, relations: ['role', 'owner'] });
    const target = await this.userRepo.findOne({ where: { id: targetUserId }, relations: ['role', 'owner'] });
    if (!granter || !target) throw new NotFoundException('User not found');

    const granterLevel = await this.getUserLevelById(granterUserId);
    const isManager = granterLevel === UserLevel.MANAGER;

    if (!isManager) {
      const canGrant = await this.isAllowed(granter.id, 'grant_sub_permissions');
      if (!canGrant) throw new ForbiddenException('مجوز واگذاری دسترسی ندارید');
      const inTree = await this.isDescendantOf(granter.id, target.id);
      if (!inTree) throw new ForbiddenException('کاربر هدف در زیرمجموعه شما نیست');
    }

    // اکشن‌های قابل واگذاری برای واگذارنده
    const mine: Set<string> = isManager
      ? new Set<string>(ALL_ACTIONS as unknown as string[])
      : await this.getAllowedActionSet(granter.id);
    const grantable: Set<string> = await this.expandGrantableForUser(mine, granter.id, !!isManager);

    // ورودی تمیز: آخرین مقدار هر اکشن
    const seen = new Map<string, boolean>();
    for (const p of incoming || []) {
      if (p && typeof p.action === 'string' && grantable.has(p.action)) {
        seen.set(p.action, !!p.is_allowed);
      }
    }

    // وضعیت فعلی هدف
    const current = await this.getAllowedActionSet(target.id);

    // دیفِ واقعی نسبت به وضعیت فعلی
    const rawToGrant: string[] = [];
    const rawToRevoke: string[] = [];
    for (const [action, val] of seen.entries()) {
      if (val && !current.has(action)) rawToGrant.push(action);
      if (!val && current.has(action)) rawToRevoke.push(action);
    }

    // اگر یکی از بچه‌ها تازه گرنت شد و parent قابل واگذاری است و قبلاً نداشت، parent را هم اضافه کن
    const anyChildNew =
      rawToGrant.some(a => TRACK_CHILDREN.includes(a));
    if (anyChildNew && grantable.has('track_driver') && !current.has('track_driver')) {
      rawToGrant.push('track_driver');
    }

    const toGrant = Array.from(new Set(rawToGrant));
    const toRevoke = Array.from(new Set(rawToRevoke));

    // هیچ تغییری؟ نه دیتابیس دست بزن، نه لاگ
    if (toGrant.length === 0 && toRevoke.length === 0) {
      return this.getByUserId(target.id);
    }

    // اعمال
    for (const action of toGrant) {
      let row = await this.rolePermissionRepo.findOne({ where: { user: { id: target.id }, action } });
      if (!row) {
        row = this.rolePermissionRepo.create({ user: target, action, is_allowed: true });
      } else {
        row.is_allowed = true;
      }
      await this.rolePermissionRepo.save(row);
      // یا: await this.setPermission(target.id, action, true, granterUserId, { silent: true });
    }

    if (toRevoke.length) {
      await this.rolePermissionRepo.createQueryBuilder()
        .delete()
        .from(RolePermission)
        .where('"user_id" = :uid AND "action" IN (:...acts)', { uid: target.id, acts: toRevoke })
        .execute();
    }

    // لاگ خلاصه فقط وقتی تغییر هست
    await this.writeAudit({
      topic: AuditTopic.PERMISSION_UPDATE,
      actorId: granterUserId,
      targetUserId: target.id,
      message: 'به‌روزرسانی مجوزها',
      metadata: { granted: toGrant, revoked: toRevoke },
    });

    return this.getByUserId(target.id);
  }


  async deletePermissionByUser(userId: number, action: string, actorUserId?: number) {
    const result = await this.rolePermissionRepo
      .createQueryBuilder()
      .delete()
      .from(RolePermission)
      .where('"user_id" = :uid AND "action" = :act', { uid: userId, act: action })
      .execute();
    if (result.affected) {
      await this.writeAudit({
        topic: AuditTopic.PERMISSION_REVOKE,
        actorId: actorUserId,
        message: `حذف مجوز ${action}`,
        targetUserId: userId,
        metadata: { action },
      });
    }
    return {
      success: !!result.affected,
      message: result.affected ? 'مجوز حذف شد.' : 'چنین مجوزی وجود ندارد.',
    };
  }

  async isAllowed(userId: number, action: string): Promise<boolean> {
    const permission = await this.rolePermissionRepo.findOne({
      where: { user: { id: userId }, action },
      relations: ['user'],
    });
    return permission?.is_allowed ?? false;
  }

  async setPermission(userId: number, action: string, is_allowed: boolean, actorUserId?: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let permission = await this.rolePermissionRepo.findOne({
      where: { user: { id: userId }, action },
    });

    if (!permission) {
      permission = this.rolePermissionRepo.create({ user, action, is_allowed });
    } else {
      permission.is_allowed = is_allowed;
    }
    const saved = await this.rolePermissionRepo.save(permission);
    await this.writeAudit({
      topic: is_allowed ? AuditTopic.PERMISSION_GRANT : AuditTopic.PERMISSION_REVOKE,
      actorId: actorUserId,
      targetUserId: userId,
      message: `${is_allowed ? 'دادن' : 'حذف'} مجوز ${action}`,
      metadata: { action },
    });
    return saved;
  }

  async getAll() {
    return this.rolePermissionRepo.find();
  }

  private async getAllowedActionSet(userId: number): Promise<Set<string>> {
    const list = await this.getByUserId(userId);
    return new Set(list.filter(p => p.is_allowed).map(p => p.action));
  }
  private async getUserLevelById(userId: number): Promise<number | undefined> {
    const row = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.role', 'r')
      .where('u.id = :id', { id: userId })
      .select('r.level', 'level')
      .getRawOne<{ level: number }>();
    return row?.level ?? undefined;
  }

  async updatePermissionsForUser(
    userId: number,
    permissions: { action: string; is_allowed: boolean }[],
    actorUserId?: number,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // وضعیت فعلی (فقط allowedها)
    const before = await this.rolePermissionRepo.find({ where: { user: { id: userId } } });
    const beforeSet = new Set(before.filter(p => p.is_allowed).map(p => p.action));

    // وضعیت موردنظر از ورودی
    const trueActions = (permissions || [])
      .filter(p => p.is_allowed === true)
      .map(p => p.action);
    const afterSet = new Set(trueActions);

    // دیف
    const granted = [...afterSet].filter(a => !beforeSet.has(a));
    const revoked = [...beforeSet].filter(a => !afterSet.has(a));

    // هیچ تغییری؟ نه دیتابیس دست بزن، نه لاگ
    if (granted.length === 0 && revoked.length === 0) {
      return before; // یا اگر خواستی فقط getByUserId برگردون
    }

    // اعمال تغییرات
    if (granted.length) {
      // گرنت اکشن‌های جدید (بی‌صدا تا لاگ تکی نخوریم)
      for (const action of granted) {
        let row = await this.rolePermissionRepo.findOne({ where: { user: { id: userId }, action } });
        if (!row) {
          row = this.rolePermissionRepo.create({ user, action, is_allowed: true });
        } else {
          row.is_allowed = true;
        }
        await this.rolePermissionRepo.save(row);
        // یا: await this.setPermission(userId, action, true, actorUserId, { silent: true });
      }
    }

    if (revoked.length) {
      await this.rolePermissionRepo.createQueryBuilder()
        .delete()
        .from(RolePermission)
        .where('"user_id" = :uid AND "action" IN (:...acts)', { uid: userId, acts: revoked })
        .execute();
      // یا: setPermission(..., false, {silent:true}) تک‌به‌تک
    }

    // لاگ فقط وقتی تغییر داشتیم
    await this.writeAudit({
      topic: AuditTopic.PERMISSION_UPDATE,
      actorId: actorUserId,
      targetUserId: userId,
      message: 'به‌روزرسانی مجوزها',
      metadata: { granted, revoked },
    });

    return this.getByUserId(userId);
  }


  // برای /role-permissions/grantable
  async getGrantableActions(granterUserId: number, _targetLevel?: number) {
    const granter = await this.userRepo.findOne({ where: { id: granterUserId }, relations: ['role'] });
    if (!granter) throw new NotFoundException('User not found');

    const granterLevel = await this.getUserLevelById(granterUserId);
    const isManager = granterLevel === UserLevel.MANAGER;
    const base: Set<string> = isManager
      ? new Set<string>(ALL_ACTIONS as unknown as string[])
      : await this.getAllowedActionSet(granterUserId);

    const expanded = await this.expandGrantableForUser(base, granterUserId, isManager);
    return Array.from(expanded);
  }
}

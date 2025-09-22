import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Users } from './users.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { RolePermissionService } from '../permissions/role-permission.service';
import * as bcrypt from 'bcrypt';
import { UserLevel } from '../entities/role.entity';
import { UpdateUserDto } from '../dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditTopic } from '../audit/audit-topics';
import { RequestContext } from '../common/request-context';
import { InjectDataSource } from '@nestjs/typeorm';
import { SuperAdminType } from './users.entity';

// ✅ اضافه شد
import { EventEmitter2 } from '@nestjs/event-emitter';

const roleFa = (lvl?: number | null) =>
  ({ 1: 'مدیرکل', 2: 'سوپرادمین', 3: 'مدیر شعبه', 4: 'مالک', 5: 'تکنسین', 6: 'راننده' } as const)[lvl ?? -1] ?? 'نامشخص';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    private readonly rolePermissionService: RolePermissionService,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly dataSource: DataSource,
    // ✅ اضافه شد: برای اعلام رویدادها به ChatService
    private readonly events: EventEmitter2,
  ) { }

  async findFirstAncestorByLevel(userId: number, level: number): Promise<Users | null> {
    let current = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['parent'],
      // ⬇️ sa_type را هم برگردان
      select: { id: true, role_level: true, sa_type: true } as any,
    });
    if (!current) return null;

    const visited = new Set<number>([current.id]);

    while (current?.parent) {
      const parent = await this.userRepo.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
        // ⬇️ اینجا هم
        select: { id: true, full_name: true, role_level: true, sa_type: true } as any,
      });
      if (!parent) return null;

      if (parent.role_level === level) return parent;

      if (visited.has(parent.id)) break;
      visited.add(parent.id);
      current = parent;
    }
    return null;
  }

  async deleteUserById(id: number, currentUser: Users) {
    if (currentUser.id === id) {
      throw new ForbiddenException('نمی‌توانید حساب خودتان را حذف کنید.');
    }

    const target = await this.userRepo.findOne({
      where: { id },
      relations: ['children'],
      select: { id: true, full_name: true, role_level: true } as any,
    });
    if (!target) throw new NotFoundException('کاربر پیدا نشد');

    try {
      await this.userRepo.manager.transaction(async (m) => {
        await m.getRepository(Users).delete(id);
      });
    } catch (e: any) {
      if ((e?.code || e?.driverError?.code) === '23503') {
        throw new ConflictException(
          'حذف ممکن نیست: هنوز رکورد وابسته‌ای به این کاربر وجود دارد (FK). برای آن FK ها CASCADE/SET NULL تنظیم کنید.'
        );
      }
      throw e;
    }

    const { ip, userAgent } = RequestContext.get();
    await this.audit.log({
      topic: AuditTopic.USER_DELETE,
      actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
      target_user: { id: target.id, name: target.full_name, role_level: target.role_level },
      message: `${currentUser.full_name} کاربر ${target.full_name} را حذف کرد.`,
      metadata: { deleted_user_id: id },
      ip,
      user_agent: userAgent,
    });

    return { ok: true };
  }

  async create(dto: CreateUserDto, currentUser: Users): Promise<Users> {
    const isManager = currentUser.role_level === UserLevel.MANAGER;        // 1
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;    // 2

    if (!isManager) {
      const allowed = await this.rolePermissionService.isAllowed(currentUser.id, 'create_user');
      if (!allowed) throw new ForbiddenException('شما مجاز به ایجاد کاربر نیستید');
    }

    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) throw new BadRequestException('این شماره موبایل قبلاً ثبت شده است.');

    if (!dto.password || !dto.password.trim()) {
      throw new BadRequestException('پسورد الزامی است.');
    }
    const hashedPassword = await bcrypt.hash(dto.password.trim(), 10);

    // تعیین والد
    const parentId = dto.parent_id ?? currentUser.id;
    let parent: Users | null = null;

    if (parentId) {
      parent = await this.userRepo.findOne({ where: { id: parentId } });
      if (!parent) throw new BadRequestException('والد یافت نشد.');

      if (isSuperAdmin) {
        const okParent =
          parent.id === currentUser.id || (await this.isDescendantOf(currentUser.id, parent.id));
        if (!okParent) throw new ForbiddenException('والد انتخاب‌شده در دامنهٔ مجاز شما نیست.');
      } else if (!isManager) {
        if (parent.id !== currentUser.id) throw new ForbiddenException('والد نامعتبر است.');
      }
    }

    if (dto.role_level === undefined) {
      throw new BadRequestException('تعیین role_level الزامی است.');
    }
    if (!isManager && dto.role_level <= currentUser.role_level) {
      throw new ForbiddenException('نقش کاربر جدید باید پایین‌تر از نقش شما باشد.');
    }

    // --- تعیین خودکار sa_type ---
    let resolvedSaType: SuperAdminType | null = null;

    if (dto.role_level === UserLevel.SUPER_ADMIN) {
      // برای خودِ سوپرادمین جدید، نوع الزامی‌ست
      if (
        !dto.sa_type ||
        !Object.values(SuperAdminType).includes(dto.sa_type as SuperAdminType)
      ) {
        throw new BadRequestException('sa_type برای سوپرادمین الزامی است (fleet/device/universal).');
      }
      resolvedSaType = dto.sa_type as SuperAdminType;
    } else {
      // برای سایر نقش‌ها، نوع را از نزدیک‌ترین SA بالاسری به ارث بگیر
      const anchorId = parent?.id ?? currentUser.id;
      const nearestSA = await this.findFirstAncestorByLevel(anchorId, UserLevel.SUPER_ADMIN);
      resolvedSaType = (nearestSA?.sa_type as SuperAdminType) ?? null;
      // اگر می‌خواهی نبودن SA را خطا بدهی، به‌جای null این را فعال کن:
      // if (!resolvedSaType) throw new BadRequestException('ساخت این کاربر خارج از دامنهٔ یک سوپرادمین معتبر است.');
    }

    const newUser = this.userRepo.create({
      full_name: dto.full_name,
      phone: dto.phone,
      password: hashedPassword,
      role_level: dto.role_level,
      max_devices: dto.max_devices ?? 0,
      max_drivers: dto.max_drivers ?? 0,
      parent,
      sa_type: resolvedSaType, // ⬅️ ست نوع سوپرادمین (برای SA یا ارث‌گرفته)
    });

    const saved = await this.userRepo.save(newUser);

    // ✅ رویداد پس از ساخت
    this.events.emit('users.created', { userId: saved.id });

    // آدیت‌لاگ
    const { ip, userAgent } = RequestContext.get();
    await this.audit.log({
      topic: AuditTopic.USER_CREATE,
      actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
      target_user: { id: saved.id, name: saved.full_name, role_level: saved.role_level },
      message: `${currentUser.full_name} (نقش: ${roleFa(currentUser.role_level)}) کاربر ${saved.full_name} (نقش: ${roleFa(saved.role_level)}) را ایجاد کرد.`,
      metadata: { created_user_id: saved.id, parent_id: parent?.id ?? null, sa_type: saved.sa_type ?? null },
      ip,
      user_agent: userAgent,
    });

    return saved;
  } غ

  async findAll(roleLevel?: number): Promise<Users[]> {
    const where = roleLevel ? { role_level: roleLevel } : {};
    return this.userRepo.find({
      where,
      relations: ['parent'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Users> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');
    return user;
  }

  async findOneScoped(id: number, currentUser: Users): Promise<Users> {
    const isManager = currentUser.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;

    const user = await this.findOne(id);
    if (isManager) return user;

    if (isSuperAdmin) {
      const allowed =
        id === currentUser.id || (await this.isDescendantOf(currentUser.id, id));
      if (!allowed) throw new ForbiddenException('اجازهٔ مشاهده این کاربر را ندارید.');
      return user;
    }

    throw new ForbiddenException('اجازهٔ مشاهده این کاربر را ندارید.');
  }

  async getUserHierarchy(userId: number): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['children', 'parent'],
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');

    const children = await Promise.all(
      (user.children ?? []).map(async (child) => {
        return await this.getUserHierarchy(child.id);
      }),
    );

    return {
      id: user.id,
      full_name: user.full_name,
      role_level: user.role_level,
      parent_id: user.parent?.id ?? null,
      children,
    };
  }

  async getUserHierarchyScoped(userId: number, currentUser: Users): Promise<any> {
    const isManager = currentUser.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;

    if (isManager) return this.getUserHierarchy(userId);

    if (isSuperAdmin) {
      const allowed =
        userId === currentUser.id ||
        (await this.isDescendantOf(currentUser.id, userId));
      if (!allowed) throw new ForbiddenException('اجازهٔ مشاهده این درخت را ندارید.');
      return this.getUserHierarchy(userId);
    }

    throw new ForbiddenException('اجازهٔ مشاهده این درخت را ندارید.');
  }

  private async isDescendantOf(ancestorId: number, targetId: number): Promise<boolean> {
    if (ancestorId === targetId) return false;
    let current = await this.userRepo.findOne({
      where: { id: targetId },
      relations: ['parent'],
    });
    const visited = new Set<number>();
    while (current?.parent) {
      if (current.parent.id === ancestorId) return true;
      if (visited.has(current.parent.id)) break;
      visited.add(current.parent.id);
      current = await this.userRepo.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
      });
    }
    return false;
  }

  async findDirectSubordinates(userId: number) {
    return this.userRepo.find({
      where: { parent: { id: userId } },
      order: { created_at: 'DESC' },
      select: { id: true, full_name: true, role_level: true },
    });
  }

  async findFlatSubordinates(userId: number): Promise<Partial<Users>[]> {
    const recursive = async (id: number): Promise<Users[]> => {
      const direct = await this.userRepo.find({
        where: { parent: { id } },
        relations: ['parent'],
      });
      const children = await Promise.all(direct.map((u) => recursive(u.id)));
      return [...direct, ...children.flat()];
    };

    const all = await recursive(userId);

    return all.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      role_level: u.role_level,
      parent_id: u.parent?.id ?? null,
    }));
  }

  // --------- ویرایش ---------
  async updateUserById(id: number, dto: UpdateUserDto, currentUser?: Users) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['parent'] });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');
    if (dto.sa_type !== undefined) {
      if (user.role_level !== UserLevel.SUPER_ADMIN)
        throw new BadRequestException('sa_type فقط برای سوپرادمین قابل تنظیم است');
      const valid = Object.values(SuperAdminType).includes(dto.sa_type as any);
      if (!valid) throw new BadRequestException('sa_type نامعتبر است');
      user.sa_type = dto.sa_type as SuperAdminType;
    }
    const isManager = currentUser?.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser?.role_level === UserLevel.SUPER_ADMIN;

    if (isSuperAdmin && currentUser!.id === id) {
      throw new ForbiddenException('سوپرادمین اجازهٔ ویرایش پروفایل خودش را ندارد');
    }
    if (isSuperAdmin) {
      const inTree = await this.isDescendantOf(currentUser!.id, id);
      if (!inTree) throw new ForbiddenException('کاربرِ هدف در زیرمجموعهٔ شما نیست');
    }
    const beforeSaType = user.sa_type ?? null;

    if (dto.sa_type !== undefined) {
      if (user.role_level !== UserLevel.SUPER_ADMIN)
        throw new BadRequestException('تنها سوپرادمین sa_type دارد');
      if (!Object.values(SuperAdminType).includes(dto.sa_type as any))
        throw new BadRequestException('sa_type نامعتبر است');

      // اگر تغییر کرده:
      if (beforeSaType !== dto.sa_type) {
        // ابتدا خود کاربر و زیرشاخه‌ها
        await this.cascadeSaType(user.id, dto.sa_type as SuperAdminType, currentUser!);
        // user در cascade به‌روز شد؛ اگر لازم است دوباره بخوان:
        user.sa_type = dto.sa_type as SuperAdminType;
      }
    }
    // 📸 Snapshot قبل از تغییر
    const before = {
      full_name: user.full_name,
      phone: user.phone,
      role_level: user.role_level,
      max_devices: user.max_devices,
      max_drivers: user.max_drivers,
      parent_id: user.parent?.id ?? null,
    };

    // اعمال تغییرات
    if (dto.role_level !== undefined) {
      if (isManager) {
        user.role_level = dto.role_level;
      } else if (isSuperAdmin) {
        if (dto.role_level <= currentUser!.role_level) {
          throw new ForbiddenException('نقش جدید باید پایین‌تر از نقش شما باشد');
        }
        user.role_level = dto.role_level;
      } else {
        throw new ForbiddenException('اجازهٔ تغییر نقش ندارید');
      }
    }

    if (dto.full_name !== undefined) user.full_name = dto.full_name;

    if (dto.phone !== undefined) {
      const dup = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (dup && dup.id !== user.id) {
        throw new BadRequestException('این شماره موبایل قبلاً ثبت شده است.');
      }
      user.phone = dto.phone;
    }

    if (dto.password !== undefined && dto.password.trim()) {
      user.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    if (dto.max_devices !== undefined) user.max_devices = dto.max_devices;
    if (dto.max_drivers !== undefined) user.max_drivers = dto.max_drivers;

    if (dto.parent_id !== undefined) {
      if (dto.parent_id === null) {
        user.parent = null;
      } else {
        const parent = await this.userRepo.findOne({ where: { id: dto.parent_id } });
        if (!parent) throw new BadRequestException('والد یافت نشد');
        if (isSuperAdmin) {
          const parentInTree =
            parent.id === currentUser!.id || (await this.isDescendantOf(currentUser!.id, parent.id));
          if (!parentInTree) throw new ForbiddenException('انتخاب والدِ نامعتبر برای زیرمجموعه');
        }
        user.parent = parent;
      }
    }

    const saved = await this.userRepo.save(user);

    // ✅ تشخیص تغییرات مهم برای سینک گروه SA
    const parentChanged = (before.parent_id ?? null) !== (saved.parent?.id ?? null);
    const roleChanged = before.role_level !== saved.role_level;

    // ✅ اگر والد یا نقش عوض شد، به ChatService خبر بده تا عضویت گروه SA Sync شود
    if (parentChanged || roleChanged) {
      this.events.emit('users.parent_changed', { userId: saved.id });
      // (در ChatService می‌توانی در صورت نیاز، برای تمام زیرمجموعه‌های saved.id هم Sync انجام بدهی)
    }

    // 📊 محاسبه‌ی تغییرات برای آدیت
    const changed: Record<string, { from: any; to: any }> = {};
    const keys = ['full_name', 'phone', 'role_level', 'max_devices', 'max_drivers', 'parent_id'] as const;
    for (const k of keys) {
      const prev = (before as any)[k];
      const next = k === 'parent_id' ? (saved.parent?.id ?? null) : (saved as any)[k];
      if (prev !== next) changed[k] = { from: prev, to: next };
    }

    if (currentUser && Object.keys(changed).length) {
      const { ip, userAgent } = RequestContext.get();

      if (changed.role_level) {
        await this.audit.log({
          topic: AuditTopic.USER_CHANGE_ROLE,
          actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
          target_user: { id: saved.id, name: saved.full_name, role_level: saved.role_level },
          message: `${currentUser.full_name} نقش ${saved.full_name} را از «${roleFa(changed.role_level.from)}» به «${roleFa(changed.role_level.to)}» تغییر داد.`,
          metadata: { before_role: changed.role_level.from, after_role: changed.role_level.to },
          ip,
          user_agent: userAgent,
        });
        delete changed.role_level;
      }

      if (Object.keys(changed).length) {
        await this.audit.log({
          topic: AuditTopic.USER_UPDATE,
          actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
          target_user: { id: saved.id, name: saved.full_name, role_level: saved.role_level },
          message: `${currentUser.full_name} اطلاعات ${saved.full_name} را ویرایش کرد.`,
          metadata: { changed },
          ip,
          user_agent: userAgent,
        });
      }
    }

    return saved;
  }
  // users.service.ts
  async cascadeSaType(rootId: number, saType: SuperAdminType, currentUser: Users) {
    const root = await this.userRepo.findOne({ where: { id: rootId }, relations: ['parent'] });
    if (!root) throw new NotFoundException('کاربر پیدا نشد');
    if (root.role_level !== UserLevel.SUPER_ADMIN)
      throw new BadRequestException('کَسکید sa_type فقط برای سوپرادمین مجاز است');

    // کنترل دسترسی: مدیرکل آزاد؛ SA فقط روی درخت خودش
    const isManager = currentUser.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;
    if (!isManager) {
      const allowed = isSuperAdmin && (root.id === currentUser.id || await this.isDescendantOf(currentUser.id, root.id));
      if (!allowed) throw new ForbiddenException('اجازهٔ اعمال روی این شاخه را ندارید');
    }

    await this.dataSource.transaction(async (trx) => {
      const repo = trx.getRepository(Users);

      // Postgres (WITH RECURSIVE)
      if (this.dataSource.options.type === 'postgres') {
        await trx.query(`
        WITH RECURSIVE subtree AS (
          SELECT id FROM users WHERE id = $1
          UNION ALL
          SELECT u.id FROM users u JOIN subtree s ON u.parent_id = s.id
        )
        UPDATE users SET sa_type = $2 WHERE id IN (SELECT id FROM subtree)
      `, [rootId, saType]);
      } else {
        // Fallback (MySQL/SQLite): BFS در اپ‌لایه
        const queue: number[] = [rootId];
        const allIds: number[] = [];
        while (queue.length) {
          const id = queue.shift()!;
          allIds.push(id);
          const children = await repo.find({ where: { parent: { id } }, select: { id: true } as any, relations: ['parent'] });
          children.forEach(c => queue.push(c.id));
        }
        if (allIds.length) {
          await repo
            .createQueryBuilder()
            .update(Users)
            .set({ sa_type: saType })
            .whereInIds(allIds)
            .execute();
        }
      }
    });

    // رویداد و آدیت
    this.events.emit('users.sa_type_changed', { userId: rootId, sa_type: saType });
    const { ip, userAgent } = RequestContext.get();
    await this.audit.log({
      topic: AuditTopic.USER_UPDATE,
      actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
      target_user: { id: root.id, name: root.full_name, role_level: root.role_level },
      message: `تعیین نوع SA به «${saType}» برای ${root.full_name} و تمام زیرشاخه‌ها`,
      metadata: { sa_type: saType, root_id: rootId },
      ip, user_agent: userAgent,
    });

    return { ok: true };
  }

}

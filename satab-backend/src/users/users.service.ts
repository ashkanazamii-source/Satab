import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, DataSource, } from 'typeorm';
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

const roleFa = (lvl?: number | null) =>
  ({ 1: 'مدیرکل', 2: 'سوپرادمین', 3: 'مدیر شعبه', 4: 'مالک', 5: 'تکنسین', 6: 'راننده' } as const)[lvl ?? -1] ?? 'نامشخص';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    private readonly rolePermissionService: RolePermissionService,
    private readonly audit: AuditService,           // ← اضافه
    @InjectDataSource() private readonly dataSource: DataSource, // ← اینو اضافه کن

  ) { }

  async findFirstAncestorByLevel(userId: number, level: number): Promise<Users | null> {
    // اول خود کاربر را با parent بگیر
    let current = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['parent'],
      select: { id: true, role_level: true } as any,
    });

    if (!current) return null;

    const visited = new Set<number>([current.id]);

    while (current?.parent) {
      // parent را هم با parentِ خودش بگیر تا بتوانیم بالا برویم
      const parent = await this.userRepo.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
        select: { id: true, full_name: true, role_level: true } as any,
      });
      if (!parent) return null;

      if (parent.role_level === level) return parent;

      if (visited.has(parent.id)) break; // جلوگیری از حلقه
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

    // ✅ همون چک‌های سطح دسترسی و اینکه children نداشته باشه

    try {
      await this.userRepo.manager.transaction(async (m) => {
        // با توجه به ON DELETE CASCADE در role_permissions،
        // فقط حذف user کافیست.
        await m.getRepository(Users).delete(id);
      });
    } catch (e: any) {
      // اگر هنوز FK دیگری جلوی حذف را بگیرد (مثلاً در جداول دیگر)
      if ((e?.code || e?.driverError?.code) === '23503') {
        throw new ConflictException(
          'حذف ممکن نیست: هنوز رکورد وابسته‌ای به این کاربر وجود دارد (FK). برای آن FK ها CASCADE/SET NULL تنظیم کنید.'
        );
      }
      throw e;
    }

    // ✅ لاگ بعد از موفقیت
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

  /**
   * ایجاد کاربر جدید
   */
  // users.service.ts
  async create(dto: CreateUserDto, currentUser: Users): Promise<Users> {
    // --- نقش فعلی
    const isManager = currentUser.role_level === UserLevel.MANAGER;      // 1
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;  // 2

    // --- مجوز ساخت کاربر
    // مدیرکل فول‌اکسس است؛ سوپرادمین باید پرمیشن create_user داشته باشد.
    if (!isManager) {
      const allowed = await this.rolePermissionService.isAllowed(currentUser.id, 'create_user');
      if (!allowed) throw new ForbiddenException('شما مجاز به ایجاد کاربر نیستید');
    }

    // --- یکتا بودن موبایل
    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) throw new BadRequestException('این شماره موبایل قبلاً ثبت شده است.');

    // --- پسورد
    if (!dto.password || !dto.password.trim()) {
      throw new BadRequestException('پسورد الزامی است.');
    }
    const hashedPassword = await bcrypt.hash(dto.password.trim(), 10);

    // --- تعیین والد
    const parentId = dto.parent_id ?? currentUser.id;
    let parent: Users | null = null;

    if (parentId) {
      parent = await this.userRepo.findOne({ where: { id: parentId } });
      if (!parent) throw new BadRequestException('والد یافت نشد.');

      if (isSuperAdmin) {
        // SA فقط زیر درخت خودش یا خودش را می‌تواند به‌عنوان والد بگذارد
        const okParent = parent.id === currentUser.id || (await this.isDescendantOf(currentUser.id, parent.id));
        if (!okParent) throw new ForbiddenException('والد انتخاب‌شده در دامنهٔ مجاز شما نیست.');
      } else if (!isManager) {
        // سایر نقش‌ها (غیر از MANAGER/SA) فعلاً فقط می‌توانند خودشان را والد بگذارند
        if (parent.id !== currentUser.id) throw new ForbiddenException('والد نامعتبر است.');
      }
      // MANAGER محدودیتی ندارد (مطابق منطق فعلی پروژه)
    }

    // --- قانون نقشِ کاربر جدید نسبت به نقش سازنده
    if (dto.role_level !== undefined) {
      // مدیرکل میتواند هر سطحی بسازد؛
      // اما SA فقط می‌تواند سطحی پایین‌تر از خودش بسازد.
      if (!isManager && dto.role_level <= currentUser.role_level) {
        throw new ForbiddenException('نقش کاربر جدید باید پایین‌تر از نقش شما باشد.');
      }
    } else {
      throw new BadRequestException('تعیین role_level الزامی است.');
    }

    // --- ساخت آبجکت و ذخیره
    const newUser = this.userRepo.create({
      full_name: dto.full_name,
      phone: dto.phone,
      password: hashedPassword,
      role_level: dto.role_level,
      max_devices: dto.max_devices ?? 0,
      max_drivers: dto.max_drivers ?? 0,
      parent,
    });

    const saved = await this.userRepo.save(newUser);

    // --- لاگ آدیت
    const { ip, userAgent } = RequestContext.get();
    await this.audit.log({
      topic: AuditTopic.USER_CREATE,
      actor: { id: currentUser.id, name: currentUser.full_name, role_level: currentUser.role_level },
      target_user: { id: saved.id, name: saved.full_name, role_level: saved.role_level },
      message: `${currentUser.full_name} (نقش: ${roleFa(currentUser.role_level)}) کاربر ${saved.full_name} (نقش: ${roleFa(saved.role_level)}) را ایجاد کرد.`,
      metadata: { created_user_id: saved.id, parent_id: parent?.id ?? null },
      ip,
      user_agent: userAgent,
    });

    return saved;
  }




  /**
   * دریافت همه کاربران (اختیاری با فیلتر سطح نقش)
   */
  async findAll(roleLevel?: number): Promise<Users[]> {
    const where = roleLevel ? { role_level: roleLevel } : {};
    return this.userRepo.find({
      where,
      relations: ['parent'],
      order: { created_at: 'DESC' },
    });
  }

  // --------- خواندنِ آزاد (فقط برای MANAGER از Controller) ---------
  async findOne(id: number): Promise<Users> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');
    return user;
  }

  // ... (بخش‌های میانی بدون تغییر)


  async findOneScoped(id: number, currentUser: Users): Promise<Users> {
    const isManager = currentUser.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser.role_level === UserLevel.SUPER_ADMIN;

    const user = await this.findOne(id); // شامل relations لازم
    if (isManager) return user;

    if (isSuperAdmin) {
      const allowed =
        id === currentUser.id || (await this.isDescendantOf(currentUser.id, id));
      if (!allowed) throw new ForbiddenException('اجازهٔ مشاهده این کاربر را ندارید.');
      return user;
    }

    // سایر نقش‌ها فعلاً اجازه ندارند
    throw new ForbiddenException('اجازهٔ مشاهده این کاربر را ندارید.');
  }

  /**
   * دریافت درخت کامل زیرمجموعه‌ها به‌صورت بازگشتی
   */
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

  /**
   * دریافت همه زیرمجموعه‌ها به صورت flat
   */

  // src/users/users.service.ts
  // src/users/users.service.ts

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
  // helper — داخل همین سرویس
  private async isDescendantOf(ancestorId: number, targetId: number): Promise<boolean> {
    if (ancestorId === targetId) return false; // ادیت/خواندن خود شخص را جدا تصمیم می‌گیریم
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

  // --------- ویرایش (قبلاً سفت شد) ---------
  async updateUserById(id: number, dto: UpdateUserDto, currentUser?: Users) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['parent'] });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');

    const isManager = currentUser?.role_level === UserLevel.MANAGER;
    const isSuperAdmin = currentUser?.role_level === UserLevel.SUPER_ADMIN;

    if (isSuperAdmin && currentUser!.id === id) {
      throw new ForbiddenException('سوپرادمین اجازهٔ ویرایش پروفایل خودش را ندارد');
    }
    if (isSuperAdmin) {
      const inTree = await this.isDescendantOf(currentUser!.id, id);
      if (!inTree) throw new ForbiddenException('کاربرِ هدف در زیرمجموعهٔ شما نیست');
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

    // 📊 محاسبه‌ی تغییرات
    const changed: Record<string, { from: any; to: any }> = {};
    const keys = ['full_name', 'phone', 'role_level', 'max_devices', 'max_drivers', 'parent_id'] as const;
    for (const k of keys) {
      const prev = (before as any)[k];
      const next = k === 'parent_id' ? (saved.parent?.id ?? null) : (saved as any)[k];
      if (prev !== next) changed[k] = { from: prev, to: next };
    }

    // 🔹 لاگ‌ها (اگر currentUser موجود است)
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

}





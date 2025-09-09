// src/acl/acl.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACL_KEY } from './acl.decorator';
import { Users } from '../users/users.entity';
import { RolePermissionService } from '../permissions/role-permission.service'; // ⬅️ مسیر درست
import { UserLevel } from '../entities/role.entity';

type AclMeta = {
  roles?: number[];
  permissions?: string[];
  requireAll?: boolean; // پیش‌فرض false (OR)
};

@Injectable()
export class AclGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissionService: RolePermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // اگر متادیتای ACL نباشه، اجازه بده (سراسری بلاک نکن)
    const acl = this.reflector.getAllAndOverride<AclMeta>(ACL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!acl) return true;

    const request = context.switchToHttp().getRequest();
    const user: Users | undefined = request?.user;
    if (!user) throw new ForbiddenException('کاربر یافت نشد.');

    // مدیرکل دسترسی کامل
    if (user.role_level === UserLevel.MANAGER) return true;

    // اگر نقش‌ها مشخص شده: باید داخلش باشه
    if (Array.isArray(acl.roles) && acl.roles.length > 0) {
      if (!acl.roles.includes(user.role_level)) {
        throw new ForbiddenException('شما اجازه دسترسی ندارید.');
      }
    }

    // اگر پرمیشن خواسته شده
    if (Array.isArray(acl.permissions) && acl.permissions.length > 0) {
      const checks = await Promise.all(
        acl.permissions.map((perm) =>
          this.rolePermissionService.isAllowed(user.id, perm).catch(() => false),
        ),
      );
      const ok = acl.requireAll ? checks.every(Boolean) : checks.some(Boolean);
      if (!ok) {
        throw new ForbiddenException('شما مجوز لازم برای این عملیات را ندارید.');
      }
    }

    return true;
  }
}

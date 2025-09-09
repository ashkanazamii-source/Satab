import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from './license.service';
import { Request } from 'express';
import { UserLevel } from '../entities/role.entity';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const user: any = req.user;

    // اگر مدیرکل بود، نیازی به بررسی لایسنس ندارد
    if (user.role_level === UserLevel.MANAGER) {
      return true;
    }

    // آیدی سوپرادمین برای بررسی لایسنس
    let licenseUserId: number;

    // اگر خود کاربر سوپرادمین است
    if (user.role_level === UserLevel.SUPER_ADMIN) {
      licenseUserId = user.id;
    }
    // اگر زیرمجموعه سوپرادمین است، باید لایسنس سوپرادمین بررسی شود
    else if (user.super_admin_id) {
      licenseUserId = user.super_admin_id;
    } else {
      throw new UnauthorizedException('شناسه سوپرادمین یافت نشد.');
    }

    const license = await this.licenseService.getActiveLicense(licenseUserId);

    if (!license) {
      throw new ForbiddenException('لایسنس فعال یافت نشد. لطفاً با پشتیبانی تماس بگیرید.');
    }

    return true;
  }
}

// src/licenses/license.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from './license.entity';
import { Users } from '../users/users.entity';
import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepo: Repository<License>
  ) {}

  /**
   * ایجاد لایسنس اولیه به مدت 12 ماه برای سوپرادمین جدید
   * این متد در زمان ثبت‌نام فراخوانی می‌شود
   */
  async createInitialLicense(user: Users): Promise<License> {
    const now = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 12); // اضافه کردن 12 ماه به تاریخ فعلی

    const license = this.licenseRepo.create({
      user,
      startDate: now,
      endDate: end,
      isPaid: false, // لایسنس اولیه رایگان است
    });

    return this.licenseRepo.save(license);
  }

  /**
   * گرفتن لایسنس فعال یک کاربر خاص
   */
  async getActiveLicense(userId: number): Promise<License | null> {
  const now = new Date();
  return this.licenseRepo.findOne({
    where: {
      user: { id: userId },
      startDate: LessThanOrEqual(now),
      endDate: MoreThanOrEqual(now),
    },
    relations: ['user'],
  });
}

  // (در صورت نیاز می‌توان متدهای تمدید و لغو نیز اضافه کرد)
}

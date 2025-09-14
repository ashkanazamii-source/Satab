import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { VehicleSettingProfile } from './profiles.entity';

@Injectable()
export class ProfilesService {
  /**
   * NestJS به صورت خودکار Repository مربوط به VehicleSettingProfile را تزریق می‌کند.
   * دیگر نیازی به مدیریت دستی کانکشن Pool نیست.
   * @param profilesRepository - ریپازیتوری برای تعامل با جدول پروفایل‌ها
   */
  constructor(
    @InjectRepository(VehicleSettingProfile)
    private readonly profilesRepository: Repository<VehicleSettingProfile>,
  ) {}

  /**
   * یک پروفایل جدید برای کاربر مشخص شده ایجاد می‌کند.
   * @param createProfileDto - داده‌های پروفایل جدید
   * @param userId - شناسه کاربری که پروفایل را ایجاد می‌کند
   */
  async create(createProfileDto: CreateProfileDto, userId: number): Promise<VehicleSettingProfile> {
    const newProfile = this.profilesRepository.create({
      ...createProfileDto,
      user: { id: userId }, // اتصال پروفایل به کاربر از طریق شناسه‌اش
    });

    return this.profilesRepository.save(newProfile);
  }

  /**
   * تمام پروفایل‌های متعلق به یک کاربر را باز می‌گرداند.
   * @param userId - شناسه کاربر
   */
  async findAll(userId: number): Promise<VehicleSettingProfile[]> {
    return this.profilesRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * یک پروفایل خاص را پیدا کرده و مالکیت آن را بررسی می‌کند.
   * این یک تابع داخلی برای جلوگیری از تکرار کد است.
   * @param id - شناسه پروفایل
   * @param userId - شناسه کاربری که درخواست داده
   */
  private async findOneAndVerifyOwnership(id: number, userId: number): Promise<VehicleSettingProfile> {
    const profile = await this.profilesRepository.findOne({
      where: { id },
      relations: ['user'], // ✅ رابطه با کاربر را نیز بارگذاری می‌کند
    });

    if (!profile) {
      throw new NotFoundException(`پروفایل با شناسه ${id} یافت نشد.`);
    }

    if (profile.user.id !== userId) {
      throw new ForbiddenException('شما اجازه دسترسی به این پروفایل را ندارید.');
    }

    return profile;
  }

  /**
   * یک پروفایل موجود را به‌روزرسانی می‌کند.
   * @param id - شناسه پروفایل برای ویرایش
   * @param updateProfileDto - داده‌های جدید
   * @param userId - شناسه کاربر برای بررسی مالکیت
   */
  async update(id: number, updateProfileDto: UpdateProfileDto, userId: number): Promise<VehicleSettingProfile> {
    // 1. ابتدا پروفایل را پیدا کرده و مالکیت آن را بررسی می‌کنیم
    const profileToUpdate = await this.findOneAndVerifyOwnership(id, userId);

    // 2. داده‌های جدید را با داده‌های موجود ادغام می‌کنیم
    const updatedProfile = Object.assign(profileToUpdate, updateProfileDto);
    
    // 3. پروفایل به‌روز شده را ذخیره می‌کنیم
    return this.profilesRepository.save(updatedProfile);
  }

  /**
   * یک پروفایل را حذف می‌کند.
   * @param id - شناسه پروفایل برای حذف
   * @param userId - شناسه کاربر برای بررسی مالکیت
   */
  async remove(id: number, userId: number): Promise<void> {
    // ابتدا پروفایل را پیدا کرده و مالکیت آن را بررسی می‌کنیم
    await this.findOneAndVerifyOwnership(id, userId);

    // اگر مالکیت تایید شد، حذف را انجام می‌دهیم
    await this.profilesRepository.delete(id);
  }
}


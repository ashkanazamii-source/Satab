import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { VehicleSettingProfile } from './profiles.entity';
import { Users } from '../users/users.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(VehicleSettingProfile)
    private readonly profilesRepository: Repository<VehicleSettingProfile>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async create(createProfileDto: CreateProfileDto, userId: number): Promise<VehicleSettingProfile> {
    const newProfile = this.profilesRepository.create({
      ...createProfileDto,
      user: { id: userId },
    });
    return this.profilesRepository.save(newProfile);
  }

  // ===== Helpers (بدون parent_id) =====

  /** بالارفتن از زنجیره‌ی والدین تا رسیدن به سوپرادمین (role_level === 2) */
  private async findTopSuperAdminId(userId: number): Promise<number> {
    // با relation parent بالا می‌رویم؛ بدون دسترسی به ستون parent_id
    let current = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['parent'],
    });
    const visited = new Set<number>();
    let steps = 0;

    while (current && steps++ < 1000 && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.role_level === 2) {
        return current.id; // خودش SA است
      }

      if (!current.parent) break; // به انتهای زنجیره رسیدیم

      // والد بعدی را با relation parent لود کن تا باز هم بتوانیم بالا برویم
      current = await this.usersRepository.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
      });
    }

    throw new ForbiddenException('سوپرادمین بالادستی پیدا نشد یا دسترسی وجود ندارد.');
  }

  /** بررسی می‌کند بیننده مجاز است پروفایل‌های owner را ببیند یا نه. */
  private async assertViewerCanSeeOwner(viewerId: number, ownerId: number): Promise<void> {
    const viewer = await this.usersRepository.findOne({
      where: { id: viewerId },
      relations: ['parent'],
    });
    if (!viewer) throw new NotFoundException('کاربر بیننده یافت نشد.');

    // خودش
    if (viewerId === ownerId) return;

    // مدیرکل (۱) همه را می‌بیند
    if (viewer.role_level === 1) return;

    // اگر بیننده SA است، فقط پروفایل‌های خودش را می‌بیند
    if (viewer.role_level === 2) {
      if (ownerId !== viewer.id) {
        throw new ForbiddenException('دسترسی به پروفایل‌های این مالک مجاز نیست.');
      }
      return;
    }

    // نقش‌های ۳..۵ فقط پروفایل‌های SA بالادستیِ خودشان را می‌بینند
    if (viewer.role_level >= 3 && viewer.role_level <= 5) {
      const topSAId = await this.findTopSuperAdminId(viewer.id);
      if (ownerId === topSAId) return;
      throw new ForbiddenException('دسترسی به پروفایل‌های این مالک مجاز نیست.');
    }

    // راننده و پایین‌تر (۶ به بعد): مجوز ندارند
    throw new ForbiddenException('دسترسی ندارید.');
  }

  // ===== خواندن با منطق دسترسی =====

  /**
   * همه‌ی پروفایل‌هایی که برای بیننده قابل مشاهده است.
   * - اگر ownerUserId وجود داشته باشد: فقط همان owner بعد از چک مجوز
   * - اگر نباشد:
   *   - SA: پروفایل‌های خودش
   *   - نقش‌های ۳..۵: پروفایل‌های SA بالادستی
   *   - مدیرکل ۱: همه‌ی پروفایل‌ها
   */
  async findAllVisible(viewerUserId: number, ownerUserId?: number): Promise<VehicleSettingProfile[]> {
    // مدیرکل: همه (بدون owner)
    const viewer = await this.usersRepository.findOne({
      where: { id: viewerUserId },
      relations: ['parent'],
    });
    if (!viewer) throw new NotFoundException('کاربر بیننده یافت نشد.');

    if (ownerUserId != null) {
      await this.assertViewerCanSeeOwner(viewerUserId, ownerUserId);
      return this.profilesRepository.find({
        where: { user: { id: ownerUserId } },
        order: { createdAt: 'DESC' },
      });
    }

    if (viewer.role_level === 1) {
      // همه را برگردان
      return this.profilesRepository.find({ order: { createdAt: 'DESC' } });
    }

    if (viewer.role_level === 2) {
      // SA: فقط خودش
      return this.profilesRepository.find({
        where: { user: { id: viewer.id } },
        order: { createdAt: 'DESC' },
      });
    }

    if (viewer.role_level >= 3 && viewer.role_level <= 5) {
      // ۳..۵: SA بالادستی
      const topSAId = await this.findTopSuperAdminId(viewer.id);
      return this.profilesRepository.find({
        where: { user: { id: topSAId } },
        order: { createdAt: 'DESC' },
      });
    }

    // نقش‌های پایین‌تر (راننده و …): هیچ
    return [];
  }

  // ===== مالکیت برای ادیت/حذف =====

  private async findOneAndVerifyOwnership(id: number, userId: number): Promise<VehicleSettingProfile> {
    const profile = await this.profilesRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException(`پروفایل با شناسه ${id} یافت نشد.`);
    if (profile.user.id !== userId) {
      throw new ForbiddenException('شما اجازه دسترسی به این پروفایل را ندارید.');
    }
    return profile;
  }

  async update(id: number, updateProfileDto: UpdateProfileDto, userId: number): Promise<VehicleSettingProfile> {
    const profileToUpdate = await this.findOneAndVerifyOwnership(id, userId);
    Object.assign(profileToUpdate, updateProfileDto);
    return this.profilesRepository.save(profileToUpdate);
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findOneAndVerifyOwnership(id, userId);
    await this.profilesRepository.delete(id);
  }
}

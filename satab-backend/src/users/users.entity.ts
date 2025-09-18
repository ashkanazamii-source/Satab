import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserLevel } from '../entities/role.entity';
import { License } from '../licenses/license.entity';
import { DriverRoute } from '../drivers/driver-route.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Device } from '../entities/device.entity';
import { RolePermission } from '../permissions/role-permission.entity';
import { VehicleSettingProfile } from '../profiles/profiles.entity'; // ✅ 1. این خط را اضافه کنید

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  full_name: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  password: string;

  @Index({ unique: true }) // اگر MySQL داری و چند NULL نمی‌پذیرد، این را بردار و Unique را در لایهٔ سرویس enforce کن
  @Column({ type: 'char', length: 16, nullable: true })
  driver_card_hex?: string | null;

  @Index()
  @Column({ type: 'enum', enum: UserLevel })
  role_level: UserLevel;

  @OneToMany(() => RolePermission, (rp) => rp.user)
  rolePermissions: RolePermission[];

  /**
   * والد عمومی (هر نقش می‌تواند والد هر نقش پایین‌تر باشد)
   */
  @ManyToOne(() => Users, (u) => u.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  @Index()
  parent?: Users | null;

  /**
   * فرزندان (زیرمجموعه‌ها)
   */
  @OneToMany(() => Users, (user) => user.parent)
  children?: Users[];

  /**
   * لایسنس‌های کاربر
   */
  @OneToMany(() => License, (license) => license.user)
  licenses: License[];

  /**
   * مسیرهای راننده (اگر نقش راننده باشد)
   */
  @OneToMany(() => DriverRoute, (route) => route.driver)
  driverRoutes: DriverRoute[];

  /**
   * دارایی‌های تحت مالکیت مستقیم این کاربر
   */
  @OneToMany(() => Vehicle, (v) => v.owner_user)
  ownedVehicles: Vehicle[];

  @OneToMany(() => Device, (d) => d.owner_user)
  ownedDevices: Device[];

  /**
   * ✅ 2. این بخش جدید را به انتهای کلاس (قبل از ستون‌های تاریخ) اضافه کنید
   * پروفایل‌های تنظیمات ذخیره‌شده توسط این کاربر
   */
  @OneToMany(() => VehicleSettingProfile, (profile) => profile.user)
  profiles: VehicleSettingProfile[];

  /**
   * سقف‌های اختیاری (برای نقش‌های بالادستی مثل SA)
   */
  @Column({ type: 'int', nullable: true })
  max_devices?: number;

  @Column({ type: 'int', nullable: true })
  max_drivers?: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


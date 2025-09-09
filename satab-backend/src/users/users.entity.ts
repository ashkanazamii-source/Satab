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
import { DriverRoute } from '../drivers/driver-route.entity'; // اگر مسیر درست this: ../driver-route/driver-route.entity
import { Vehicle } from '../vehicles/vehicle.entity';
import { Device } from '../entities/device.entity';
import { RolePermission } from '../permissions/role-permission.entity';

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

  @Index()
  @Column({ type: 'enum', enum: UserLevel })
  role_level: UserLevel;
  @OneToMany(() => RolePermission, (rp) => rp.user)
  rolePermissions: RolePermission[];
  /**
   * والد عمومی (هر نقش می‌تواند والد هر نقش پایین‌تر باشد)
   * توجه: ستون parent_id به‌صورت خودکار ساخته می‌شود؛
   * نیاز به @Column جداگانه ندارد.
   */
  @ManyToOne(() => Users, (u) => u.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  @Index() // برای کوئری‌های بازگشتی
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

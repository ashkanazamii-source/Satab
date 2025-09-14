import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn,
  JoinColumn
} from 'typeorm';
import { Users } from '../users/users.entity';

@Entity('vehicle_setting_profile')
export class VehicleSettingProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'jsonb' })
  settings: any;

  @ManyToOne(() => Users, (user) => user.profiles, {
    nullable: false,      // ✅ تضمین می‌کند که هر پروفایل حتما به یک کاربر متصل باشد
    onDelete: 'CASCADE',  // ✅ اگر کاربر حذف شد، پروفایل‌هایش هم حذف شوند
  })
  @JoinColumn({ name: 'user_id' }) // ✅ نام ستون کلید خارجی را به صورت استاندارد تعریف می‌کند
  user: Users;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' }) // ✅ نام ستون در دیتابیس
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' }) // ✅ نام ستون در دیتابیس
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from '../users/users.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, (u) => u.rolePermissions, {
    nullable: false,
    onDelete: 'CASCADE', // 👈 با حذف user، رکوردهای مجوزش هم پاک می‌شن
  })
  @JoinColumn({ name: 'user_id' }) // ← کاربری که این مجوز برایش تعریف شده (سوپرادمین خاص)
  user: Users;

  @Column()
  action: string;

  @Column({ default: false })
  is_allowed: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;


}

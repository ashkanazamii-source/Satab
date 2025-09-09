// src/licenses/license.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from '../users/users.entity';

@Entity('licenses')
export class License {
  @PrimaryGeneratedColumn()
  id: number;

  // ارتباط با کاربر (صاحب این لایسنس فقط سوپرادمین خواهد بود)
  @ManyToOne(() => Users, user => user.licenses, { onDelete: 'CASCADE' })
  user: Users;

  // زمان شروع اعتبار لایسنس
  @Column({ type: 'timestamp' })
  startDate: Date;

  // زمان پایان اعتبار لایسنس
  @Column({ type: 'timestamp' })
  endDate: Date;

  // وضعیت پرداخت (آیا این لایسنس پولی بوده یا رایگان؟)
  @Column({ default: false })
  isPaid: boolean;

  // تاریخ ساخت رکورد
  @CreateDateColumn()
  created_at: Date;

  // تاریخ آخرین بروزرسانی رکورد
  @UpdateDateColumn()
  updated_at: Date;
}

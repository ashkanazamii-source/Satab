// src/violations/violation.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

// می‌تونی انواع دیگه هم بعداً اضافه کنی
export type ViolationType = 'geofence_exit' | 'speeding' | 'idle' | string;

@Entity('violations')
@Index(['vehicle_id', 'created_at'])
export class ViolationEntity {
  // توصیه: برای bigint در PG، در TS از string استفاده کن تا overflow نشه
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ type: 'bigint' })
  vehicle_id!: string;          // REFERENCES vehicles(id)

  @Index()
  @Column({ type: 'bigint', nullable: true })
  driver_user_id!: string | null; // REFERENCES users(id) nullable

  @Column({ type: 'text' })
  type!: ViolationType;         // مثل 'geofence_exit'

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  meta!: Record<string, any>;   // هر اطلاعات اضافی (geofence_id, point, ...)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

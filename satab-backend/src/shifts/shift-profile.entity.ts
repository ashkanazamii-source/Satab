import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { ShiftStatus } from '../shifts/shift.entity'; // از همون منبع حقیقت شما

export type ShiftType = 'morning' | 'evening' | 'night';

export type ShiftProfilePayload = {
  start_time: string;       // 'HH:mm'
  end_time: string;         // 'HH:mm'
  type: ShiftType;
  vehicle_id?: number | null;
  route_id?: number | null;
  station_start_id?: number | null;
  station_end_id?: number | null;
  note?: string | null;
  status?: ShiftStatus;     // پیش‌فرض DRAFT
  apply_dates?: string[];   // YYYY-MM-DD (میلادی)
};

@Entity('shift_profiles')
@Index('idx_shift_profiles_name', ['name'])
export class ShiftProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'jsonb' })
  payload: ShiftProfilePayload;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

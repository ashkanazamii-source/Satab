// src/shifts/shift.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

/** =========================
 *  Enums (منبع حقیقت واحد)
 *  ========================= */
export enum ShiftStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  LOCKED = 'LOCKED',
}

export enum ShiftType {
  MORNING = 'morning',
  EVENING = 'evening',
  NIGHT = 'night',
}

/** ترنسفورمر ساده برای time: DB ⇄ 'HH:mm' */
const TimeHHmm = {
  to: (v?: string | null) => (v ?? null),                 // به DB همان را بده (type: time)
  from: (v?: string | null) => (v ? String(v).slice(0,5) : null), // از DB فقط HH:mm بده
};

/** =========================
 *  Entity
 *  ========================= */
@Entity('shifts')
@Index('idx_shifts_driver_date', ['driver_id', 'date'])
@Index('idx_shifts_driver_date_start', ['driver_id', 'date', 'start_time'])
@Index('idx_shifts_status', ['status'])
@Check(`"end_time" > "start_time"`) // پایان باید بعد از شروع باشد (در سطح DB)
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  driver_id: number;

  @Column({ type: 'int', nullable: true })
  vehicle_id: number | null;

  @Column({ type: 'int', nullable: true })
  route_id: number | null;

  @Column({ type: 'int', nullable: true })
  station_start_id: number | null;

  @Column({ type: 'int', nullable: true })
  station_end_id: number | null;

  /** YYYY-MM-DD (میلادی) */
  @Column({ type: 'date' })
  date: string;

  /** HH:mm */
  @Column({ type: 'time', transformer: TimeHHmm })
  start_time: string;

  /** HH:mm */
  @Column({ type: 'time', transformer: TimeHHmm })
  end_time: string;

  @Column({ type: 'enum', enum: ShiftType })
  type: ShiftType;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.DRAFT })
  status: ShiftStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

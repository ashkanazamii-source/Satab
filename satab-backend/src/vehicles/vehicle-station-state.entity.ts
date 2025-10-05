// vehicle-station-state.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('vehicle_station_state')
@Index(['vehicle_id'], { unique: true })
export class VehicleStationState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicle_id: number;

  /** ایستگاه بعدی که باید تیک بخورد (بر اساس order_no) */
  @Column({ type: 'int', default: 1 })
  next_order_no: number;

  /** آیا تا الان حتی یک پوزیشن پردازش شده؟ برای قانون first-fix */
  @Column({ type: 'boolean', default: false })
  had_any_pos: boolean;

  /** اگر داخل Core ایستگاه next هستیم، ID آن ایستگاه */
  @Column({ type: 'int', nullable: true })
  inside_station_id: number | null;

  /** زمان ورود معتبر به inside_station (برای dwell) */
  @Column({ type: 'timestamptz', nullable: true })
  inside_since: Date | null;

  /** آخرین ایستگاه تیک‌خورده */
  @Column({ type: 'int', nullable: true })
  last_visited_station_id: number | null;

  /** آخرین زمان بروزرسانی */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

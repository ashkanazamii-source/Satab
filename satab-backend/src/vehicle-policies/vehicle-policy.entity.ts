import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Users } from '../users/users.entity';

export type VehicleTypeCode = 'bus'|'minibus'|'van'|'tanker'|'truck'|'khavar'|'sedan'|'pickup';
export type MonitorKey =
  | 'gps' | 'ignition' | 'speed' | 'idle_time' | 'odometer'
  | 'fuel_level' | 'engine_temp' | 'harsh_events' | 'geo_fence' | 'door_open';

@Entity('vehicle_policies')
@Index(['user_id', 'vehicle_type_code'], { unique: true })
export class VehiclePolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', length: 20 })
  vehicle_type_code: VehicleTypeCode;

  @Column({ type: 'boolean', default: false })
  is_allowed: boolean;

  @Column({ type: 'int', default: 0 })
  max_count: number;

  // آرایه‌ای از کلیدهای مانیتورینگ
  @Column({ type: 'jsonb', default: () => "'[]'" })
  monitor_params: MonitorKey[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

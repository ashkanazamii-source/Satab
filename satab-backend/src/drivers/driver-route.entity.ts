// src/driver-route/driver-route.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

export enum DriverRouteStatus {
  active = 'active',
  finished = 'finished',
}

@Entity('driver_routes')
@Index(['driver_id', 'started_at'])
@Index(['driver_id', 'status'])
@Index(['vehicle_id', 'started_at'])
export class DriverRoute {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * راننده مسیر
   */
  @ManyToOne(() => Users, (u) => u.driverRoutes, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'driver_id' })
  driver: Users;

  @Column()
  driver_id: number;

  /**
   * وسیله نقلیه (اختیاری)
   */
  @ManyToOne(() => Vehicle, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle?: Vehicle | null;

  @Column({ type: 'int', nullable: true })
  vehicle_id?: number | null;

  /**
   * نقاط GPS مسیر به همراه زمان ثبت
   */
  @Column({ type: 'jsonb', default: [] })
  gps_points: { lat: number; lng: number; timestamp: string }[];

  /**
   * وضعیت مسیر (فعال یا پایان‌یافته)
   */
  @Column({
    type: 'enum',
    enum: DriverRouteStatus,
    default: DriverRouteStatus.active,
  })
  status: DriverRouteStatus;

  /**
   * زمان شروع و پایان
   */
  @CreateDateColumn()
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at?: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /**
   * مسافت کل بر حسب کیلومتر
   */
  @Column({ type: 'float', default: 0 })
  total_distance_km: number;
}

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
  Check,
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
// هر راننده در لحظه فقط یک مسیر active
@Index('uniq_active_route_per_driver', ['driver_id'], {
  unique: true,
  where: `status = 'active'`,
})
// برای فیلتر روزانهٔ سریع
@Index(['driver_id', 'day_bucket'])
// پایان بعد از شروع (یا خالی)
@Check(`"finished_at" IS NULL OR "finished_at" > "started_at"`)
export class DriverRoute {
  @PrimaryGeneratedColumn()
  id: number;

  /** راننده مسیر */
  @ManyToOne(() => Users, (u) => u.driverRoutes, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'driver_id' })
  driver: Users;

  @Column()
  driver_id: number;

  /** وسیله نقلیه (اختیاری) */
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
   * اتصال نرم به انتساب فعال هنگام شروع مسیر
   * (پل بین Route و DriverVehicleAssignment بدون نیاز به import آن entity)
   */
  @Index()
  @Column({ type: 'int', nullable: true })
  assignment_id?: number | null;
  // src/driver-route/driver-route.entity.ts


  @Column({ type: 'jsonb', nullable: true })
  start_vehicle_snapshot?: {
    ts?: string | null;
    odometer_km?: number | null;
    ignition?: boolean | null;
    engine_temp?: number | null;
    last_location_lat?: number | null;
    last_location_lng?: number | null;
    last_location_ts?: string | null;
    current_route_id?: number | null;
    // هرچی از برد داری می‌تونی اینجا بذاری
    [k: string]: any;
  } | null;

  // ---------- NEW: ستون‌های سایه‌ای آخرین تله‌متری ----------
  @Column({ type: 'timestamptz', nullable: true })
  last_telemetry_ts?: Date | null;

  @Column({ type: 'boolean', nullable: true })
  last_ignition?: boolean | null;

  @Column({ type: 'int', nullable: true })
  last_idle_time_sec?: number | null;

  @Column({ type: 'double precision', nullable: true })
  last_odometer_km?: number | null;

  @Column({ type: 'double precision', nullable: true })
  last_engine_temp?: number | null;
  /**
   * نقاط GPS مسیر به همراه زمان ثبت
   * (نکته: در بلندمدت بهتره به جدول جدا منتقل شود؛ فعلاً jsonb می‌ماند)
   */
  @Column({ type: 'jsonb', default: [] })
  gps_points: { lat: number; lng: number; timestamp: string }[];

  /** وضعیت مسیر (فعال یا پایان‌یافته) */
  @Column({
    type: 'enum',
    enum: DriverRouteStatus,
    default: DriverRouteStatus.active,
  })
  status: DriverRouteStatus;

  /** زمان شروع و پایان */
  // اگر نیاز داری شروع را دستی ست کنی، Column با default بهتر از CreateDateColumn است
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at?: Date | null;

  @UpdateDateColumn()
  updated_at: Date;

  /** مسافت کل بر حسب کیلومتر (کش) */
  @Column({ type: 'double precision', default: 0 })
  total_distance_km: number;

  /** کش‌های مفید برای نمایش سریع */
  @Column({ type: 'int', default: 0 })
  points_count: number;

  @Column({ type: 'double precision', nullable: true })
  last_lat?: number | null;

  @Column({ type: 'double precision', nullable: true })
  last_lng?: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_point_ts?: Date | null;
  // driver-route.entity.ts
  @Column({ type: 'jsonb', default: [] })
  telemetry_events: Array<{
    ts: string;
    ignition?: boolean | null;
    idle_time?: number | null;
    odometer?: number | null;
    engine_temp?: number | null;
  }>;

  /**
   * سطل تاریخ روز شروع برای گزارش‌گیری سریع (DATE(started_at))
   * مقداردهی در سرویس هنگام ساخت مسیر یا با Trigger DB
   */
  @Column({ type: 'date', nullable: true })
  day_bucket?: string | null;
}

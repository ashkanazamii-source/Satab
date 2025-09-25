import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column,
  Index, CreateDateColumn, Check
} from 'typeorm';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('driver_vehicle_assignments')
@Index(['driver_id', 'ended_at'])
@Index(['vehicle_id', 'ended_at'])
// برای کوئری‌های «در چه زمانی چه کسی رانندهٔ این ماشین بود؟»
@Index(['vehicle_id', 'started_at'])
@Index(['driver_id', 'started_at'])
// فقط PostgreSQL: یک انتساب باز per راننده
@Index('uniq_open_assignment_per_driver', ['driver_id'], {
  unique: true,
  where: 'ended_at IS NULL',
})
// فقط PostgreSQL: یک انتساب باز per خودرو
@Index('uniq_open_assignment_per_vehicle', ['vehicle_id'], {
  unique: true,
  where: 'ended_at IS NULL',
})
// ended_at باید بعد از started_at باشد (یا NULL)
@Check(`"ended_at" IS NULL OR "ended_at" > "started_at"`)
export class DriverVehicleAssignment {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => Users, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Users;
  @Column() driver_id: number;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;
  @Column() vehicle_id: number;

  // ایندکس زمانی برای گزارش‌گیری و look-up بر اساس ts
  @Index()
  @Column({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at?: Date;

  @CreateDateColumn()
  created_at: Date;
}

/**
 * نکتهٔ دیتابیسی (پیشنهادی برای Migration):
 * اگر PostgreSQL داری، برای جلوگیری از همپوشانی بازه‌ها روی یک راننده/یک خودرو
 * می‌توانی GIST Exclusion Constraint بگذاری (TypeORM با migration دستی):
 *
 *  ALTER TABLE driver_vehicle_assignments
 *  ADD CONSTRAINT no_overlap_per_vehicle
 *  EXCLUDE USING gist (
 *    vehicle_id WITH =,
 *    tstzrange(started_at, ended_at) WITH &&
 *  );
 *
 * مشابه همین را می‌توان برای driver_id گذاشت.
 */

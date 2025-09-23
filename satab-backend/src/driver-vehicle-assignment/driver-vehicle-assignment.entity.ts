import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column,
  Index, CreateDateColumn, Check
} from 'typeorm';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('driver_vehicle_assignments')
@Index(['driver_id', 'ended_at'])
@Index(['vehicle_id', 'ended_at'])
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

  // ایندکس زمانی برای گزارش‌گیری
  @Index()
  @Column({ type: 'timestamptz' }) started_at: Date;

  @Column({ type: 'timestamptz', nullable: true }) ended_at?: Date;

  @CreateDateColumn() created_at: Date;
}

// src/driver-vehicle-assignment/driver-vehicle-assignment.entity.ts
import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('driver_vehicle_assignments')
@Index(['driver_id', 'ended_at'])
@Index(['vehicle_id', 'ended_at'])
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

  @Column({ type: 'timestamptz' }) started_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) ended_at?: Date;

  @CreateDateColumn() created_at: Date;
}

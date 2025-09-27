// src/violations/violation.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
  ManyToOne, JoinColumn, RelationId
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Users } from '../users/users.entity';

// در صورت استفاده از off_route حتماً در union باشد
export type ViolationType = 'geofence_exit' | 'speeding' | 'idle' | 'off_route' | string;

@Entity('violations')
@Index(['vehicle_id', 'created_at'])
export class ViolationEntity {
  @PrimaryGeneratedColumn() // INT → number
  id!: number;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @RelationId((v: ViolationEntity) => v.vehicle)
  @Index()
  @Column({ type: 'int' })
  vehicle_id!: number; // REFERENCES vehicles(id)

  @ManyToOne(() => Users, { onDelete: 'SET NULL', eager: false, nullable: true })
  @JoinColumn({ name: 'driver_user_id' })
  driver!: Users | null;

  @RelationId((v: ViolationEntity) => v.driver)
  @Index()
  @Column({ type: 'int', nullable: true })
  driver_user_id!: number | null; // REFERENCES users(id)

  @Column({ type: 'text' })
  type!: ViolationType; // e.g. 'geofence_exit'

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  meta!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

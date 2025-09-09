import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
  RelationId
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';

export type ConsumableMode = 'km' | 'time';

@Entity({ name: 'consumables' })
export class Consumable {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, v => v.consumables, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  // فقط خواندنی؛ ستون جداگانه تعریف نکن
  @RelationId((c: Consumable) => c.vehicle)
  vehicleId: number;

  @Column({ type: 'varchar', length: 10 })
  mode: ConsumableMode;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt?: Date | null;

  @Column({ name: 'base_odometer_km', type: 'double precision', nullable: true })
  baseOdometerKm?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

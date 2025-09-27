// src/geofence/geofence.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, Unique, ManyToOne, JoinColumn, RelationId
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity'; // مسیر صحیح پروژه خودت

export type GeofenceType = 'polygon' | 'circle';
// اگر LatLng جای دیگری تعریف شده، از آن import کن و این را حذف کن
export type LatLng = { lat: number; lng: number };

@Entity({ name: 'geofences' })
@Unique(['vehicleId'])
export class GeofenceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle;

  @RelationId((g: GeofenceEntity) => g.vehicle)
  @Index()
  @Column({ type: 'int' })
  vehicleId!: number;

  @Column({ type: 'varchar', length: 16 })
  type!: GeofenceType; // 'polygon' | 'circle'

  // polygon
  @Column({ type: 'jsonb', nullable: true })
  polygonPoints!: LatLng[] | null;

  // circle
  @Column({ type: 'double precision', nullable: true })
  centerLat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  centerLng!: number | null;

  @Column({ type: 'double precision', nullable: true })
  radiusM!: number | null;

  // common settings
  @Column({ type: 'int', default: 5 })
  toleranceM!: number; // (m)

  @Column({ type: 'int', default: 1 })
  outsideN!: number;

  @Column({ type: 'int', default: 60000 })
  cooldownMs!: number; // ms

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

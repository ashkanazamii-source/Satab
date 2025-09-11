import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

export type GeofenceType = 'polygon' | 'circle';
export type LatLng = { lat: number; lng: number };

@Entity({ name: 'geofences' })
@Unique(['vehicleId'])
export class GeofenceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

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
  toleranceM!: number; // حاشیه اطمینان (متر)

  // ⬇️ قبلاً 3 بود؛ برای ثبت با اولین خروج می‌گذاریم 1
  @Column({ type: 'int', default: 1 })
  outsideN!: number;

  @Column({ type: 'int', default: 60000 })
  cooldownMs!: number; // فاصله بین ثبت تخلف (ms)

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

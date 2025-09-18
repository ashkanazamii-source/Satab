import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('route_geofence_state')
@Index(['vehicle_id', 'route_id'], { unique: true })
export class RouteGeofenceState {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  vehicle_id: number;

  @Index()
  @Column({ type: 'int' })
  route_id: number;

  @Column({ type: 'boolean', default: false })
  inside: boolean;

  @Column({ type: 'double precision', nullable: true })
  last_distance_m: number | null;

  @Column({ type: 'int', nullable: true })
  last_segment_index: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_changed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

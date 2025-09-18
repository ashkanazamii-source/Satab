import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

type RouteFenceEventType = 'enter' | 'exit';

@Entity('route_geofence_events')
export class RouteGeofenceEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  vehicle_id: number;

  @Index()
  @Column({ type: 'int' })
  route_id: number;

  @Column({ type: 'varchar', length: 10 })
  type: RouteFenceEventType;

  @Column({ type: 'double precision', nullable: true })
  distance_m: number | null;

  @Column({ type: 'int', nullable: true })
  segment_index: number | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at: Date;
}

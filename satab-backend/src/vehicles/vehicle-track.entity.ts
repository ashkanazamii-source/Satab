// vehicle-track.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('vehicle_tracks')
export class VehicleTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  vehicle_id: number;

  @Index()
  @Column('timestamptz')
  ts: Date;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @Column({ type: 'int', nullable: true })
  current_route_id: number | null;
}

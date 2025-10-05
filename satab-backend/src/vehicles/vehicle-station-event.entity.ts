// vehicle-station-event.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

type StationEventType = 'enter' | 'exit' | 'visit'; // visit == تیک خوردن

@Entity('vehicle_station_events')
@Index(['vehicle_id', 'station_id', 'created_at'])
export class VehicleStationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicle_id: number;

  @Column({ type: 'int' })
  station_id: number;

  @Column({ type: 'int' })
  order_no: number;

  @Column({ type: 'varchar', length: 16 })
  type: StationEventType;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

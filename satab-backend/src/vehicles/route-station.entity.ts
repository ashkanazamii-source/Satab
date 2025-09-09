import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn
} from 'typeorm';
import { Route } from './route.entity';

@Entity('route_stations')
export class RouteStation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  route_id: number;

  @ManyToOne(() => Route, r => r.stations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column()
  order_no: number;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @Column({ type: 'int', nullable: true })
  radius_m: number | null;
}

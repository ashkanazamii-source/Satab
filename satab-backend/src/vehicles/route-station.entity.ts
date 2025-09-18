// route-station.entity.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Check } from 'typeorm';
import { Route } from './route.entity';

@Entity('route_stations')
@Index('ux_route_stations_route_order', ['route', 'order_no'], { unique: true })
@Index('ix_route_stations_route', ['route'])
@Check('chk_route_stations_order_no', '"order_no" > 0')
@Check('chk_route_stations_lat', '"lat" >= -90 AND "lat" <= 90')
@Check('chk_route_stations_lng', '"lng" >= -180 AND "lng" <= 180')
export class RouteStation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Route, r => r.stations, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @Column({ type: 'int' })
  order_no!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  name!: string | null;

  @Column({ type: 'int', nullable: true })
  radius_m!: number | null;
}

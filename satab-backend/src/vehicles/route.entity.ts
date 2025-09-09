import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany
} from 'typeorm';
import { RouteStation } from './route-station.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  owner_user_id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'int', default: 60 })
  threshold_m: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToMany(() => RouteStation, s => s.route)
  stations: RouteStation[];
}

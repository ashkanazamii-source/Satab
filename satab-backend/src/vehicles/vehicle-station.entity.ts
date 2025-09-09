// vehicle-station.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('vehicle_stations')
export class VehicleStation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  vehicle_id: number;

  @Index()
  @Column({ type: 'int' })
  owner_user_id: number; // ⬅️ سوپرادمینی که این ایستگاه‌ها برای خودش ساخته

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'int', default: 100 })
  radius_m: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
  
}

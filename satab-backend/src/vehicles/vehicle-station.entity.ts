// vehicle-station.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('vehicle_stations')
@Index(['vehicle_id', 'order_no'], { unique: false }) // هر ماشین، ایستگاه‌ها با ترتیب یکتا
export class VehicleStation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  vehicle_id: number;

  @Index()
  @Column({ type: 'int' })
  owner_user_id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  /** شعاع اصلی ورود/خروج (Core) */
  @Column({ type: 'int', default: 100 })
  radius_m: number;

  /** ترتیب ایستگاه در مسیر خودرو (۱..N) */
  @Column({ type: 'int', default: 1 })
  order_no: number;

  /** آیا این ایستگاه «ماموریت‌دار» است؟ */
  @Column({ type: 'boolean', default: false })
  is_mission: boolean;

  /** حداقل زمان ماندن برای تیک خوردن (ثانیه) */
  @Column({ type: 'int', default: 20 })
  dwell_sec: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

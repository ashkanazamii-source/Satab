import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn, RelationId, BeforeInsert, BeforeUpdate, OneToMany
} from 'typeorm';
import { Users } from '../users/users.entity';
import { Consumable } from '../consumables/consumable.entity';

type CountryCode = 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

function normalizePlate(input: string) {
  if (!input) return '';
  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arDigits = '٠١٢٣٤٥٦٧٨٩';
  const mapDigit = (ch: string) => {
    const iFa = faDigits.indexOf(ch);
    if (iFa >= 0) return String(iFa);
    const iAr = arDigits.indexOf(ch);
    if (iAr >= 0) return String(iAr);
    return ch;
  };
  return input
    .trim()
    .split('')
    .map(mapDigit)
    .join('')
    .replace(/[\s\-_.]/g, '')
    .toUpperCase();
}

export enum VehicleStatus {
  active = 'active',
  inactive = 'inactive',
  in_service = 'in_service',
  retired = 'retired',
}

@Entity('vehicles')
@Index(['country_code', 'plate_norm'], { unique: true }) // یکتا به ازای کشور+پلاک نرمال
@Index(['country_code', 'plate_no'])                     // کمک برای جستجو
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, (u) => u.ownedVehicles, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner_user: Users;

  @RelationId((v: Vehicle) => v.owner_user)
  owner_user_id: number;

  // کشور پلاک (ISO-3166 alpha-2)
  @Column({ type: 'char', length: 2, default: 'IR' })
  country_code: CountryCode;

  @Column({ type: 'varchar', length: 20 })
  vehicle_type_code: 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';

  // ورودی خام
  @Column({ type: 'varchar', length: 32 })
  plate_no: string;

  // نرمال‌شده برای یکتا/جستجو
  @Column({ type: 'varchar', length: 32 })
  plate_norm: string;

  @Column({ nullable: true })
  vin?: string;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.active })
  status: VehicleStatus;

  @Column({ type: 'int', nullable: true })
  manufactured_year?: number;

  @Column({ type: 'int', nullable: true })
  odometer_km?: number;

  @Column({ nullable: true })
  fuel_type?: string; // diesel/petrol/CNG/EV/...

  @Column({ type: 'int', nullable: true })
  tank_capacity_liters?: number; // برای تانکر

  @Column({ nullable: false, unique: true })
  tracker_imei?: string;

  @Column({ type: 'float', nullable: true })
  last_location_lat?: number;

  @Column({ type: 'float', nullable: true })
  last_location_lng?: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_gps_at?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  @BeforeUpdate()
  setPlateNorm() {
    this.plate_norm = normalizePlate(this.plate_no);

  }
  // vehicle.entity.ts
  @Column({ type: 'timestamptz', nullable: true })
  last_location_ts?: Date;
  @Column({ type: 'int', default: 0 })
  ignition_on_sec_since_reset!: number;

  // وضعیت فعلی موتور
  @Column({ type: 'boolean', nullable: true })
  ignition?: boolean;

  // آخرین زمانی که وضعیت موتور تغییر کرد
  @Column({ type: 'timestamptz', nullable: true })
  last_ignition_change_at?: Date;

  // (اختیاری) زمان آخرین ریست شمارنده
  @Column({ type: 'timestamptz', nullable: true })
  ignition_counter_reset_at?: Date;

  @Column({ type: 'int', nullable: true, default: 0 })
  idle_time_sec?: number;

  @Column({ nullable: true })
  current_route_id?: number
  
  @OneToMany(() => Consumable, c => c.vehicle)
  consumables: Consumable[];

}

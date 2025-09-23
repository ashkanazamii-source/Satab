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

// UID سخت‌افزاری: هگز Uppercase با طول دقیق 24
function normalizeUidHex(input?: string | null) {
  if (!input) return null;
  const hex = String(input).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return hex.length === 24 ? hex : null;
}

// نرمال‌سازی نام برای جستجو/یکتا
function normalizeName(input: string) {
  if (!input) return '';
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

export enum VehicleStatus {
  active = 'active',
  inactive = 'inactive',
  in_service = 'in_service',
  retired = 'retired',
}

@Entity('vehicles')
@Index(['country_code', 'plate_norm'], { unique: true })
@Index(['country_code', 'plate_no'])
@Index(['responsible_user']) // ⬅️ برای فیلتر سریع
// توجه: TypeORM با اشاره به relation «owner_user» ایندکس را روی ستون FK (owner_user_id) می‌سازد
@Index(['owner_user', 'name_norm'], { unique: true, where: '"name_norm" IS NOT NULL' })
@Index(['device_uid'], { unique: true, where: '"device_uid" IS NOT NULL' })
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Users, (u) => u.ownedVehicles, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner_user!: Users;

  @RelationId((v: Vehicle) => v.owner_user)
  owner_user_id!: number;

  // --- نام نمایشی خودرو ---
  @Column({ type: 'varchar', length: 64, nullable: true })
  name?: string | null;

  @ManyToOne(() => Users, { onDelete: 'SET NULL', eager: true, nullable: true })
  @JoinColumn({ name: 'responsible_user_id' })
  responsible_user?: Users | null;

  @RelationId((v: Vehicle) => v.responsible_user)
  responsible_user_id?: number | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  name_norm?: string | null;

  // کشور پلاک (ISO-3166 alpha-2)
  @Column({ type: 'char', length: 2, default: 'IR' })
  country_code!: CountryCode;

  @Column({ type: 'varchar', length: 20 })
  vehicle_type_code!: 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';

  // ورودی خام
  @Column({ type: 'varchar', length: 32 })
  plate_no!: string;

  // نرمال‌شده برای یکتا/جستجو
  @Column({ type: 'varchar', length: 32 })
  plate_norm!: string;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin?: string;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.active })
  status!: VehicleStatus;

  @Column({ type: 'int', nullable: true })
  manufactured_year?: number;

  @Column({ type: 'int', nullable: true })
  odometer_km?: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fuel_type?: string;

  @Column({ type: 'int', nullable: true })
  tank_capacity_liters?: number;

  // IMEI اگر موقع ساخت معلوم نیست، nullable باشه
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  tracker_imei?: string | null;

  // ✅ UID سخت‌افزاری 96 بیتی (هگز 24 کاراکتری)
  @Column({ type: 'char', length: 24, nullable: true })
  device_uid?: string | null;

  @Column({ type: 'double precision', nullable: true })
  last_location_lat?: number;

  @Column({ type: 'double precision', nullable: true })
  last_location_lng?: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_gps_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // (پیشنهاد: یکی از این دو را نگه دار)
  @Column({ type: 'timestamptz', nullable: true })
  last_location_ts?: Date;

  @Column({ type: 'int', default: 0 })
  ignition_on_sec_since_reset!: number;

  @Column({ type: 'boolean', nullable: true })
  ignition?: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_ignition_change_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ignition_counter_reset_at?: Date;

  @Column({ type: 'int', nullable: true, default: 0 })
  idle_time_sec?: number;

  @Column({ type: 'int', nullable: true })
  current_route_id?: number;

  @OneToMany(() => Consumable, (c) => c.vehicle)
  consumables!: Consumable[];

  @BeforeInsert()
  @BeforeUpdate()
  setCalculatedFields() {
    this.plate_norm = normalizePlate(this.plate_no);
    this.device_uid = normalizeUidHex(this.device_uid);
    this.name_norm = this.name ? normalizeName(this.name) : null;
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  RelationId,
} from 'typeorm';
import { Users } from '../users/users.entity';

export enum DeviceStatus {
  active = 'active',
  inactive = 'inactive',
  under_maintenance = 'under_maintenance',
  retired = 'retired',
}

@Entity('devices')
@Index(['serial_no'], { unique: true })
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, (u) => u.ownedDevices, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'owner_user_id' })
  owner_user: Users;

  @RelationId((d: Device) => d.owner_user)
  owner_user_id: number;

  @Column({ type: 'varchar', length: 40 })
  device_type_code: 'water_standing' | 'water_economic' | 'other';

  @Column()
  serial_no: string;

  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.active })
  status: DeviceStatus;

  // مکان/اتصال اختیاری
  @Column({ nullable: true })
  province?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'float', nullable: true })
  lat?: number;

  @Column({ type: 'float', nullable: true })
  lng?: number;

  @Column({ nullable: true })
  fw_version?: string;

  @Column({ nullable: true })
  hw_revision?: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Check,
} from 'typeorm';

@Entity('pairing')
@Index(['code']) // جستجوهای عمومی
@Index('pairing_active_by_code_exp', ['code', 'expires_at'], { where: '"used_at" IS NULL' })
// یکتا: در هر لحظه فقط یک ردیفِ استفاده‌نشده با این کد
@Index('pairing_active_code_uniq', ['code'], { unique: true, where: '"used_at" IS NULL' })
@Check(`"code" ~ '^[0-9]{4}$'`)
@Check(`"device_id" IS NULL OR "device_id" ~ '^[0-9a-f]{24}$'`)
export class PairingCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'char', length: 4 })
  code!: string;                 // "0000".."9999"

  @Column({ type: 'int' })
  user_id!: number;              // ownerId

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  used_at!: Date | null;

  @Column({ type: 'char', length: 24, nullable: true })
  device_id!: string | null;     // 96-bit hex (24 chars)

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_name!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

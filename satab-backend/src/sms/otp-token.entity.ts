// otp-token.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('otp_tokens')
export class OtpToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 20 })
  phone: string; // مثل 989121234567

  @Column()
  code_hash: string; // هشِ کد 6 رقمی (نه خود کد)

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ default: 0 })
  attempts: number; // شمارنده تلاش برای این توکن

  @CreateDateColumn()
  created_at: Date;

  // مثلا: signup, login, reset
  @Column({ length: 24 })
  purpose: string;
}

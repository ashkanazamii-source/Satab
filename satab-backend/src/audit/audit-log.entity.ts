import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index
} from 'typeorm';
import { Users } from '../users/users.entity';
import { AuditTopic } from './audit-topics';

@Entity('audit_logs')
@Index(['created_at'])
@Index(['topic'])
@Index(['actor_id'])
@Index(['target_user_id'])
@Index(['entity_type', 'entity_id'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AuditTopic })
  topic: AuditTopic;

  @Column({ type: 'varchar', length: 64, nullable: true })
  event?: string | null;

  // ✅ ستون واقعی + رابطه (FK روی همین ستون)
  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: Users | null;

  @Column({ type: 'int', nullable: true })
  target_user_id: number | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_user_id' })
  target_user?: Users | null;

  // 📸 اسنپ‌شات‌ها
  @Column({ type: 'varchar', length: 128, nullable: true })
  actor_name_snapshot?: string | null;

  @Column({ type: 'smallint', nullable: true })
  actor_role_level_snapshot?: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  target_name_snapshot?: string | null;

  @Column({ type: 'smallint', nullable: true })
  target_role_level_snapshot?: number | null;

  // 🎯 سوژه‌های غیرکاربری
  @Column({ type: 'varchar', length: 64, nullable: true })
  entity_type?: string | null;

  @Column({ type: 'int', nullable: true })
  entity_id?: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  entity_label_snapshot?: string | null;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  user_agent?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

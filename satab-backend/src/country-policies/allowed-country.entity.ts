import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Users } from '../users/users.entity';

@Entity('user_allowed_countries')
@Index(['user_id', 'country_code'], { unique: true })
export class AllowedCountry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @Column()
  user_id: number;

  @Column({ type: 'char', length: 2 })
  country_code: 'IR'|'QA'|'AE'|'IQ'|'AF'|'TM'|'TR';

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

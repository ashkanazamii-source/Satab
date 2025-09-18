// route.entity.ts
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RouteStation } from './route-station.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number; // توجه: در PG ممکنه به صورت string برگرده

  // بهتره NOT NULL باشد (اگر دیتای قدیمی null داری، موقتاً nullable: true بگذار و مایگریت کن)
  @Column({ type: 'bigint', nullable: true })
  owner_user_id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int', default: 60 })
  threshold_m!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  // OneToMany صاحب FK نیست؛ حذف/کَسکِید را باید در ManyToOne تعریف کنی
  @OneToMany(() => RouteStation, s => s.route, { cascade: false })
  stations!: RouteStation[];
}

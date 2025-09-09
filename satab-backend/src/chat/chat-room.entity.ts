// src/chat/entities/chat-room.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, JoinColumn, Index, Unique
} from 'typeorm';
import { Users } from '../users/users.entity';
import { ChatMembership } from './chat-membership.entity';
import { ChatMessage } from './chat-message.entity';

export type ChatRoomType = 'SA_GROUP' | 'DIRECT';

@Entity('chat_rooms')
@Unique('UQ_chat_direct_key', ['direct_key'])
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['SA_GROUP', 'DIRECT'] })
  type: ChatRoomType;

  @Index()
  @Column({ type: 'int', nullable: true })
  sa_root_user_id: number | null;

  @ManyToOne(() => Users, { nullable: true })
  @JoinColumn({ name: 'sa_root_user_id' })
  saRoot?: Users | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  // برای چت دوتایی: "minId-maxId"
  @Column({ type: 'varchar', length: 100, nullable: true })
  direct_key: string | null;

  // null ⇒ از پیش‌فرض ۱۰MB استفاده کن
  @Column({ type: 'int', nullable: true })
  max_upload_mb: number | null;

  @Column({ type: 'int', name: 'created_by' })
  created_by: number;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'created_by' })
  createdBy: Users;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ChatMembership, m => m.room)
  members: ChatMembership[];

  @OneToMany(() => ChatMessage, m => m.room)
  messages: ChatMessage[];
}

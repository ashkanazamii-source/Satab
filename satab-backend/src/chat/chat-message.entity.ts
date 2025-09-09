// src/chat/entities/chat-message.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, OneToMany } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { Users } from '../users/users.entity';
import { ChatRead } from './chat-read.entity';

export type ChatMessageKind = 'TEXT' | 'IMAGE' | 'FILE';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  room_id: number;

  @ManyToOne(() => ChatRoom, r => r.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ type: 'int' })
  sender_id: number;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'sender_id' })
  sender: Users;

  @Column({ type: 'enum', enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' })
  kind: ChatMessageKind;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'text', nullable: true })
  attachment_url: string | null;

  @Column({ type: 'int', nullable: true })
  attachment_size: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  attachment_mime: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => ChatRead, r => r.message)
  reads: ChatRead[];
}

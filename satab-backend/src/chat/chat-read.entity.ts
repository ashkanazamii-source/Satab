// src/chat/entities/chat-read.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, Unique } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { Users } from '../users/users.entity';

@Entity('chat_reads')
@Unique('UQ_message_reader', ['message_id', 'reader_id'])
export class ChatRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  message_id: number;

  @Column({ type: 'int' })
  reader_id: number;

  @ManyToOne(() => ChatMessage, m => m.reads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: ChatMessage;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reader_id' })
  reader: Users;

  @CreateDateColumn()
  read_at: Date;
}

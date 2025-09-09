// src/chat/entities/chat-membership.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, Unique } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { Users } from '../users/users.entity';

@Entity('chat_memberships')
@Unique('UQ_room_user', ['room_id', 'user_id'])
export class ChatMembership {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  room_id: number;

  @Column({ type: 'int' })
  user_id: number;

  @ManyToOne(() => ChatRoom, r => r.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @CreateDateColumn()
  joined_at: Date;
}

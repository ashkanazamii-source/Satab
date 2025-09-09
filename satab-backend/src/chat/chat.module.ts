// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { ChatRoom } from './chat-room.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatMembership } from './chat-membership.entity';
import { ChatRead } from './chat-read.entity';
import { Users } from '../users/users.entity';

import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';

import { UserModule } from '../users/users.module';
import { AclModule } from '../acl/acl.module';
import { RolePermissionModule } from '../permissions/role-permission.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ChatRoom, ChatMessage, ChatMembership, ChatRead, Users]),
        JwtModule.register({ secret: process.env.JWT_SECRET || 'dev' }),
        UserModule,
        AclModule,
        RolePermissionModule,
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
    exports: [ChatService],

})
export class ChatModule { }

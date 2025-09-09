import {
    WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
    SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatMessage } from '../chat/chat-message.entity';
import { Users } from '../users/users.entity';

type RoomKind = 'DIRECT' | 'GROUP';
type WsUser = { id: number };

type SavedMessage = {
    id: number;
    room: { kind: RoomKind; groupId?: number; peerId?: number };
    senderId: number;
    senderName: string;
    text?: string;
    createdAt: string;
    attachmentUrl?: string | null;
    kind: 'TEXT' | 'IMAGE' | 'FILE';
};

@WebSocketGateway({
    cors: { origin: true, credentials: true },
    path: '/ws',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;

    constructor(
        private readonly jwt: JwtService,
        private readonly cfg: ConfigService,
        private readonly chatService: ChatService,
    ) { }

    // === in-memory state (اگر Redis دارید، بگذارید رو RedisAdapter) ===
    private socketUser = new Map<string, WsUser>();       // socket.id -> user
    private userSockets = new Map<number, Set<string>>(); // userId -> socketIds
    private roomMembers = new Map<string, Set<number>>(); // roomName -> userIds

    // === room naming (یکدست و ساده) ===
    private dmRoom(a: number, b: number) {
        const [x, y] = a < b ? [a, b] : [b, a];
        return `DM:${x}:${y}`;
    }
    private groupRoom(id: number) { return `GRP:${id}`; }
    private userRoom(id: number) { return `U:${id}`; } // برای ارسال مستقیم به یک کاربر (fallback)

    // === helpers ===
    private emitToUsers(userIds: number[], event: string, data: any) {
        for (const uid of userIds) this.server.to(this.userRoom(uid)).emit(event, data);
    }
    private addOnline(u: WsUser, sid: string) {
        this.socketUser.set(sid, u);
        if (!this.userSockets.has(u.id)) this.userSockets.set(u.id, new Set());
        this.userSockets.get(u.id)!.add(sid);
    }
    private removeOnline(sid: string) {
        const u = this.socketUser.get(sid);
        if (!u) return;
        this.socketUser.delete(sid);
        const sids = this.userSockets.get(u.id);
        if (sids) {
            sids.delete(sid);
            if (!sids.size) this.userSockets.delete(u.id);
        }
        // از همهٔ اتاق‌ها حذف و presence.leave پخش
        for (const [room, members] of this.roomMembers) {
            if (members.delete(u.id)) {
                this.server.to(room).emit('presence.leave', { userId: u.id, room });
                if (!members.size) this.roomMembers.delete(room);
            }
        }
    }
    private ensureJoin(socket: Socket, userId: number, room: string) {
        socket.join(room);
        if (!this.roomMembers.has(room)) this.roomMembers.set(room, new Set());
        const set = this.roomMembers.get(room)!;
        if (!set.has(userId)) {
            set.add(userId);
            this.server.to(room).emit('presence.join', { userId, room });
        }
    }
    private ensureLeave(socket: Socket, userId: number, room: string) {
        socket.leave(room);
        const set = this.roomMembers.get(room);
        if (set && set.delete(userId)) {
            this.server.to(room).emit('presence.leave', { userId, room });
            if (!set.size) this.roomMembers.delete(room);
        }
    }

    // === auth ===
    private authSocket(sock: Socket): WsUser {
        const token =
            (sock.handshake.auth?.token as string) ||
            (sock.handshake.query?.token as string) ||
            (sock.handshake.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');

        if (!token) throw new Error('NO_TOKEN');

        try {
            const secret = this.cfg.get<string>('JWT_SECRET');
            if (!secret) throw new Error('JWT_SECRET_NOT_SET');

            const payload: any = this.jwt.verify(token, { secret });

            const id: number = payload?.sub ?? payload?.id;
            if (!id) throw new Error('BAD_TOKEN');

            console.log('[GW] AUTH_OK', { sid: sock.id, userId: id });
            return { id };
        } catch (e: any) {
            console.warn('[GW] VERIFY_FAIL', {
                err: e?.message,
                hasAuth: !!sock.handshake.auth?.token,
                hasQuery: !!sock.handshake.query?.token,
                hasHdr: !!sock.handshake.headers['authorization'],
            });
            throw new Error('BAD_TOKEN');
        }
    }

    async handleConnection(socket: Socket) {
        try {
            const u = this.authSocket(socket);
            console.log('[GW] CONNECT', { sid: socket.id, userId: u.id });
            this.addOnline(u, socket.id);
            socket.join(this.userRoom(u.id));
            socket.emit('connected', { ok: true });
        } catch (err: any) {
            console.warn('[GW] CONNECT_FAIL', { sid: socket.id, err: err?.message });
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: Socket) {
        const u = this.socketUser.get(socket.id);
        console.log('[GW] DISCONNECT', { sid: socket.id, userId: u?.id });
        this.removeOnline(socket.id);
    }

    // === اتاق‌ها (یکدست برای GROUP و DIRECT) ===
    @SubscribeMessage('room.join')
    joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: { kind: RoomKind; groupId?: number; peerId?: number }) {
        const u = this.socketUser.get(socket.id);
        if (!u) throw new WsException('Unauthorized');

        let room = '';
        if (body.kind === 'DIRECT' && body.peerId) room = this.dmRoom(u.id, body.peerId);
        else if (body.kind === 'GROUP' && body.groupId) room = this.groupRoom(body.groupId);
        else throw new WsException('Bad room payload');

        this.ensureJoin(socket, u.id, room);
        const members = Array.from(this.roomMembers.get(room) ?? []);
        console.log('[GW] JOIN', { sid: socket.id, userId: u.id, body, room, members });
        return { ok: true, room };
    }

    @SubscribeMessage('room.leave')
    leaveRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: { kind: RoomKind; groupId?: number; peerId?: number }) {
        const u = this.socketUser.get(socket.id);
        if (!u) throw new WsException('Unauthorized');

        let room = '';
        if (body.kind === 'DIRECT' && body.peerId) room = this.dmRoom(u.id, body.peerId);
        else if (body.kind === 'GROUP' && body.groupId) room = this.groupRoom(body.groupId);
        else throw new WsException('Bad room payload');

        this.ensureLeave(socket, u.id, room);
        const members = Array.from(this.roomMembers.get(room) ?? []);
        console.log('[GW] LEAVE', { sid: socket.id, userId: u.id, body, room, members });
        return { ok: true, room };
    }

    // === تایپینگ برای همهٔ اعضا ===
    @SubscribeMessage('typing.start')
    typingStart(
        @ConnectedSocket() socket: Socket,
        @MessageBody() b: { kind: RoomKind; groupId?: number; peerId?: number },
    ) {
        const u = this.socketUser.get(socket.id)!;
        const room = b.kind === 'DIRECT'
            ? this.dmRoom(u.id, b.peerId!)
            : this.groupRoom(b.groupId!);
        socket.to(room).emit('typing.started', { userId: u.id, room, at: Date.now() });
    }
    @SubscribeMessage('typing.stop')
    typingStop(
        @ConnectedSocket() socket: Socket,
        @MessageBody() b: { kind: RoomKind; groupId?: number; peerId?: number },
    ) {
        const u = this.socketUser.get(socket.id)!;
        const room = b.kind === 'DIRECT'
            ? this.dmRoom(u.id, b.peerId!)
            : this.groupRoom(b.groupId!);
        socket.to(room).emit('typing.stopped', { userId: u.id, room, at: Date.now() });
    }

    // === ارسال پیام (بدون هیچ شرط مزاحم) ===
    @SubscribeMessage('chat.message.send')
    async wsSend(
        @ConnectedSocket() socket: Socket,
        @MessageBody() body: {
            kind: RoomKind;
            groupId?: number;
            peerId?: number;
            text?: string;
            attachmentUrl?: string | null;
        },
    ) {
        const u = this.socketUser.get(socket.id);
        if (!u) throw new WsException('Unauthorized');
        console.log('[BE] chat.message.send IN', { sid: socket.id, userId: u?.id, body });

        let roomId: number;

        try {
            if (body.kind === 'DIRECT' && body.peerId) {
                const dmRoom = await this.chatService.ensureDirectRoom(u.id, body.peerId);
                roomId = dmRoom.id;
            } else if (body.kind === 'GROUP' && body.groupId) {
                roomId = body.groupId;
                const isMember = await this.chatService.canJoinRoom(u.id, roomId);
                if (!isMember) throw new WsException('Access denied to room');
            } else {
                throw new WsException('Invalid room type or missing room identifier.');
            }

            const savedMessage = await this.chatService.sendMessage({
                roomId: roomId,
                senderId: u.id,
                text: body.text,
                attachmentUrl: body.attachmentUrl,
            });

            if (!savedMessage) {
                console.error('[GW] SEND_ERROR: sendMessage returned null/undefined');
                throw new WsException('Failed to save message');
            }

            console.log('[GW] SEND_SAVED_MSG', savedMessage);

            const wsMessage = this.mapMessageToWs(savedMessage);
            console.log('[GW] wsSend: Final wsMessage to be emitted:', JSON.stringify(wsMessage, null, 2));

            let roomName = '';
            let audience: number[] = [];
            if (body.kind === 'DIRECT') {
                const peer = body.peerId!;
                roomName = this.dmRoom(u.id, peer);
                audience = [u.id, peer];
            } else {
                const groupId = body.groupId!;
                roomName = this.groupRoom(groupId);
                audience = Array.from(this.roomMembers.get(roomName) ?? new Set<number>());
            }

            console.log('[GW] SEND_EMIT', { roomName, audience, wsMessage });

            this.server.to(roomName).emit('message:new', wsMessage);

            console.log('[GW] SEND_DONE', { id: wsMessage.id });
            return { ok: true, id: wsMessage.id };

        } catch (error) {
            console.error('[GW] SEND_ERROR', error);
            if (error instanceof WsException) {
                throw error;
            } else {
                throw new WsException('Failed to send message: ' + (error.message || 'Unknown error'));
            }
        }
    }

    // === رسیدِ خواندن (برای همهٔ اعضای اتاق هم پخش می‌شود) ===
    @SubscribeMessage('chat.message.read')
    async wsRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() b: { messageId: number; kind: RoomKind; groupId?: number; peerId?: number },
    ) {
        const u = this.socketUser.get(socket.id)!;
        const roomName =
            b.kind === 'DIRECT'
                ? this.dmRoom(u.id, b.peerId!)
                : this.groupRoom(b.groupId!);

        const evt = { messageId: b.messageId, readerId: u.id };

        this.server.to(roomName).emit('message:read', evt);
        const audience = Array.from(this.roomMembers.get(roomName) ?? new Set<number>());
        this.emitToUsers(audience, 'message:read', evt);

        return { ok: true };
    }

    // === Presence list (فقط گزارش) ===
    @SubscribeMessage('presence.list')
    presence(@ConnectedSocket() socket: Socket, @MessageBody() b: { kind: RoomKind; groupId?: number; peerId?: number }) {
        const u = this.socketUser.get(socket.id)!;
        const roomName = b.kind === 'DIRECT' ? this.dmRoom(u.id, b.peerId!) : this.groupRoom(b.groupId!);
        const users = Array.from(this.roomMembers.get(roomName) ?? new Set<number>());
        console.log('[GW] PRESENCE_LIST', { sid: socket.id, userId: u.id, roomName, users });
        return { users };
    }

    private mapMessageToWs(m: ChatMessage & { sender?: Users | null }): SavedMessage {
        console.log('[GW] mapMessageToWs INPUT:', JSON.stringify(m, null, 2));

        const senderId = Number(m.sender_id ?? m.sender?.id);
        if (isNaN(senderId) || senderId <= 0) {
            console.error('[GW] mapMessageToWs: Invalid or missing senderId', { m, senderId });
            throw new Error('Sender ID is missing or invalid in message object');
        }

        let senderName: string;
        const senderFullName = m.sender?.full_name;
        if (typeof senderFullName === 'string' && senderFullName.trim()) {
            senderName = senderFullName.trim();
        } else {
            senderName = `کاربر #${senderId}`;
        }

        let roomInfo: { kind: RoomKind; groupId?: number; peerId?: number };
        if (m.room?.type === 'DIRECT' || m.room?.direct_key) {
            const directKey = m.room.direct_key || '0-0';
            const [a, b] = String(directKey).split('-').map(Number);
            const peerId = senderId === a ? b : a;
            roomInfo = { kind: 'DIRECT', peerId };
        } else {
            roomInfo = { kind: 'GROUP', groupId: Number(m.room?.id) };
        }

        let kind: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';
        if (m.kind) {
            kind = m.kind;
        } else if (m.attachment_url) { 
            kind = 'IMAGE';
        }

        const result: SavedMessage = {
            id: Number(m.id),
            room: roomInfo,
            senderId: senderId,
            senderName: senderName,
            kind: kind,
            text: m.text ?? undefined,
            attachmentUrl: m.attachment_url ?? null,
            createdAt: m.created_at?.toISOString() ?? new Date().toISOString(),
        };

        console.log('[GW] mapMessageToWs OUTPUT:', JSON.stringify(result, null, 2));
        return result;
    }

    // ===== Bridge: وقتی پیام با HTTP ساخته شد =====
    @OnEvent('chat.message.created')
    handleCreatedFromHttp(payload: {
        message: ChatMessage & { sender: Users; room: any };
        roomType: 'DIRECT' | 'SA_GROUP';
        saRootId: number | null;
        audienceUserIds: number[];
    }) {
        const { message, roomType, audienceUserIds } = payload;
        console.log('[GW] HTTP_EVENT', { type: 'message.created', roomType, audienceUserIds, messageId: message?.id });

        if (!message) {
            console.warn('[GW] HTTP_EVENT: message payload is missing');
            return;
        }

        try {
            const wsMsg = this.mapMessageToWs(message);
            console.log('[GW] handleCreatedFromHttp: Final wsMsg to be emitted:', JSON.stringify(wsMsg, null, 2));

            if (roomType === 'DIRECT' && message?.room?.direct_key) {
                const [a, b] = String(message.room.direct_key).split('-').map(Number);
                const roomName = this.dmRoom(a, b);
                console.log('[GW] HTTP_EMIT_DM', { roomName, wsMsg });
                this.server.to(roomName).emit('message:new', wsMsg);
                this.emitToUsers([a, b], 'message:new', wsMsg);
                return;
            }

            if (roomType === 'SA_GROUP' && message?.room?.id) {
                const groupId = Number(message.room.id);
                const roomName = this.groupRoom(groupId);
                console.log('[GW] HTTP_EMIT_GRP', { roomName, wsMsg, audienceUserIds });
                this.server.to(roomName).emit('message:new', wsMsg);
                if (Array.isArray(audienceUserIds) && audienceUserIds.length) {
                    this.emitToUsers(audienceUserIds, 'message:new', wsMsg);
                }
            }
        } catch (err) {
            console.error('[GW] HTTP_EVENT_PROCESSING_ERROR', err, { message, roomType });
        }
    }

    // ===== Bridge: وقتی Read با HTTP ثبت شد =====
    @OnEvent('chat.message.read')
    handleReadFromHttp(payload: {
        messageId: number;
        readerId: number;
        senderId: number;
        roomType: 'DIRECT' | 'SA_GROUP';
        saRootId: number | null;
        audienceUserIds: number[];
    }) {
        const { messageId, readerId, roomType, audienceUserIds } = payload;

        let roomName = '';
        if (roomType === 'DIRECT') {
            if (Array.isArray(audienceUserIds) && audienceUserIds.length === 2) {
                const [a, b] = audienceUserIds.slice().sort((x, y) => x - y);
                roomName = this.dmRoom(a, b);
            }
        }

        const evt = { messageId, readerId };

        if (roomType === 'DIRECT' && roomName) {
            this.server.to(roomName).emit('message:read', evt);
            if (Array.isArray(audienceUserIds) && audienceUserIds.length) {
                this.emitToUsers(audienceUserIds, 'message:read', evt);
            }
        } else if (roomType === 'SA_GROUP') {
            if (Array.isArray(audienceUserIds) && audienceUserIds.length) {
                this.emitToUsers(audienceUserIds, 'message:read', evt);
            }
        }
    }

    // ===== Bridge: تغییر سقف آپلود از طریق HTTP =====
    @OnEvent('chat.room.upload_limit_updated')
    handleUploadLimitChange(payload: {
        roomId: number;
        maxBytes: number;
        roomType: 'DIRECT' | 'SA_GROUP';
        saRootId: number | null;
        audienceUserIds: number[];
    }) {
        const { roomId, maxBytes, roomType, audienceUserIds } = payload;

        if (roomType === 'DIRECT' && Array.isArray(audienceUserIds) && audienceUserIds.length) {
            this.emitToUsers(audienceUserIds, 'config.upload_limit_updated', { roomId, maxBytes });
            const [a, b] = audienceUserIds.slice().sort((x, y) => x - y);
            const r = this.dmRoom(a, b);
            this.server.to(r).emit('config.upload_limit_updated', { roomId, maxBytes });
        } else if (roomType === 'SA_GROUP') {
            const r = this.groupRoom(roomId);
            this.server.to(r).emit('config.upload_limit_updated', { roomId, maxBytes });

            if (Array.isArray(audienceUserIds) && audienceUserIds.length) {
                this.emitToUsers(audienceUserIds, 'config.upload_limit_updated', { roomId, maxBytes });
            }
        }
    }
}
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
        console.log('[GW] SEND_IN', { sid: socket.id, userId: u.id, body });

        try {
            // 1) تعیین roomId و دسترسی
            let roomId: number;
            if (body.kind === 'DIRECT' && body.peerId) {
                const dm = await this.chatService.ensureDirectRoom(u.id, body.peerId);
                roomId = dm.id;
            } else if (body.kind === 'GROUP' && body.groupId) {
                roomId = body.groupId;
                const isMember = await this.chatService.canJoinRoom(u.id, roomId);
                if (!isMember) throw new WsException('Access denied to room');
            } else {
                throw new WsException('Invalid room type or missing room identifier.');
            }

            // 2) ذخیره پیام
            const savedMessage = await this.chatService.sendMessage({
                roomId,
                senderId: u.id,
                text: body.text,
                attachmentUrl: body.attachmentUrl,
            });
            if (!savedMessage) throw new WsException('Failed to save message');

            const wsMessage = this.mapMessageToWs(savedMessage);

            // 3) نام اتاق و مخاطبان
            let roomName = '';
            let audienceUserIds: number[] = [];

            if (body.kind === 'DIRECT') {
                const peer = body.peerId!;
                const a = Math.min(u.id, peer);
                const b = Math.max(u.id, peer);
                roomName = this.dmRoom(a, b);
                audienceUserIds = [u.id, peer];
            } else {
                roomName = this.groupRoom(body.groupId!);
                // فقط آنلاین‌هایی که join کرده‌اند را داریم؛ همین‌ها را هم فالبک می‌کنیم
                audienceUserIds = Array.from(this.roomMembers.get(roomName) ?? []);
            }

            // 4) ارسال
            const socketsInRoomBefore = Array.from(this.server.sockets.adapter.rooms.get(roomName) ?? []);
            console.log('[GW] SEND_EMIT', { roomName, wsMessage, socketsInRoomBefore });

            // به خود اتاق
            this.server.to(roomName).emit('message:new', wsMessage);

            // فالبک مطمئن به U:<id> (حتی اگر join نشده باشند)
            if (audienceUserIds.length) {
                this.emitToUsers(audienceUserIds, 'message:new', wsMessage);
            } else if (body.kind === 'DIRECT') {
                // DM: اگر به هر دلیل لیست خالی شد، لااقل به فرستنده بفرست
                this.emitToUsers([u.id], 'message:new', wsMessage);
            }

            const socketsInRoomAfter = Array.from(this.server.sockets.adapter.rooms.get(roomName) ?? []);
            console.log('[GW] SEND_DONE', { id: wsMessage.id, socketsInRoomAfter });

            return { ok: true, id: wsMessage.id };
        } catch (error: any) {
            console.error('[GW] SEND_ERROR', { msg: error?.message || error, stack: error?.stack });
            if (error instanceof WsException) throw error;
            throw new WsException('Failed to send message: ' + (error?.message || 'Unknown error'));
        }
    }

    @SubscribeMessage('chat.message.read')
    async wsRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() b: { messageId: number; kind: 'DIRECT' | 'GROUP'; groupId?: number; peerId?: number },
    ) {
        const u = this.socketUser.get(socket.id);
        if (!u) throw new WsException('Unauthorized');

        console.log('[GW] READ_IN', { sid: socket.id, userId: u.id, body: b });

        // 1. پیام را به عنوان خوانده شده علامت بزن (مثل قبل)
        await this.chatService.markRead(b.messageId, u.id);

        // 2. اطلاعات پیام را برای پیدا کردن فرستنده اصلی واکشی کن
        const message = await this.chatService.findMessageById(b.messageId);
        if (!message) {
            console.warn(`[GW] READ_WARN: Message with id ${b.messageId} not found.`);
            return { ok: false, error: 'Message not found' };
        }

        const evt = { messageId: b.messageId, readerId: u.id };

        // 3. ارسال رویداد به کل اتاق (مثل قبل)
        if (b.kind === 'DIRECT' && b.peerId) {
            const roomName = this.dmRoom(u.id, b.peerId);
            this.server.to(roomName).emit('message:read', evt);
            console.log(`[GW] READ_OUT_DM to room ${roomName}`);
        } else if (b.kind === 'GROUP' && b.groupId) {
            const roomName = this.groupRoom(b.groupId);
            this.server.to(roomName).emit('message:read', evt);
            console.log(`[GW] READ_OUT_GRP to room ${roomName}`);
        }

        // 4. 🔥 ارسال تضمین شده رویداد به فرستنده پیام و خواننده پیام
        const audience = new Set<number>([message.sender_id, u.id]);
        this.emitToUsers(Array.from(audience), 'message:read', evt);
        console.log(`[GW] READ_OUT_GUARANTEED to users: ${Array.from(audience).join(', ')}`);

        return { ok: true };
    }


    /* @SubscribeMessage('chat.message.read')
     async wsRead(
         @ConnectedSocket() socket: Socket,
         @MessageBody() b: { messageId: number; kind: 'DIRECT' | 'GROUP'; groupId?: number; peerId?: number },
     ) {
         const u = this.socketUser.get(socket.id);
         if (!u) throw new WsException('Unauthorized');
 
         console.log('[GW] READ_IN', { sid: socket.id, userId: u.id, body: b }); // ⬅️
 
         await this.chatService.markRead(b.messageId, u.id);
 
         const evt = { messageId: b.messageId, readerId: u.id };
 
         if (b.kind === 'DIRECT' && b.peerId) {
             const [a, bPeer] = [Math.min(u.id, b.peerId), Math.max(u.id, b.peerId)];
             const roomName = this.dmRoom(a, bPeer);
 
             this.server.to(roomName).emit('message:read', evt);
             this.emitToUsers([u.id, b.peerId], 'message:read', evt);
 
             const socketsInRoom = Array.from(this.server.sockets.adapter.rooms.get(roomName) ?? []);
             console.log('[GW] READ_OUT_DM', { roomName, evt, socketsInRoom }); // ⬅️
         } else if (b.kind === 'GROUP' && b.groupId) {
             const roomName = this.groupRoom(b.groupId);
 
             this.server.to(roomName).emit('message:read', evt);
 
             // ⬅️ فالبک: اگر کاربری به هر دلیل عضو اتاق نشده بود، به U:<id> هم بفرست
             const memberUserIds = Array.from(this.roomMembers.get(roomName) ?? []);
             if (memberUserIds.length) this.emitToUsers(memberUserIds, 'message:read', evt);
 
             const socketsInRoom = Array.from(this.server.sockets.adapter.rooms.get(roomName) ?? []);
             console.log('[GW] READ_OUT_GRP', { roomName, evt, socketsInRoom, memberUserIds }); // ⬅️
         }
 
         return { ok: true };
     }*/




    // === Presence list (فقط گزارش) ===
    @SubscribeMessage('presence.list')
    presence(@ConnectedSocket() socket: Socket, @MessageBody() b: { kind: RoomKind; groupId?: number; peerId?: number }) {
        const u = this.socketUser.get(socket.id)!;
        const roomName = b.kind === 'DIRECT' ? this.dmRoom(u.id, b.peerId!) : this.groupRoom(b.groupId!);
        const users = Array.from(this.roomMembers.get(roomName) ?? new Set<number>());
        console.log('[GW] PRESENCE_LIST', { sid: socket.id, userId: u.id, roomName, users });
        return { users };
    }

    private mapMessageToWs(
        m: ChatMessage & { sender?: Users | null; room?: any }
    ): SavedMessage {
        console.log('[GW] mapMessageToWs INPUT:', JSON.stringify(m, null, 2));

        // --- sender ---
        const senderId = Number((m as any).sender_id ?? (m as any).senderId ?? m.sender?.id);
        if (!Number.isFinite(senderId) || senderId <= 0) {
            console.error('[GW] mapMessageToWs: Invalid or missing senderId', { senderId, m });
            throw new Error('Sender ID is missing or invalid in message object');
        }

        const senderNameRaw =
            (m as any).senderName ??
            m.sender?.full_name ??
            (typeof (m as any).sender_full_name === 'string' ? (m as any).sender_full_name : null);
        const senderName =
            typeof senderNameRaw === 'string' && senderNameRaw.trim()
                ? senderNameRaw.trim()
                : `کاربر #${senderId}`;

        // --- room (DIRECT/GROUP) ---
        let roomInfo: { kind: RoomKind; groupId?: number; peerId?: number };

        // اگر اتاق DIRECT است، از direct_key «a-b» peerId را دربیار
        const roomType = m?.room?.type ?? (m as any).roomType ?? null;
        const directKey =
            (m?.room?.direct_key as string | undefined) ??
            ((m as any).room?.directKey as string | undefined) ??
            (typeof (m as any).direct_key === 'string' ? (m as any).direct_key : undefined);

        if (roomType === 'DIRECT' || directKey) {
            const key = (directKey ?? '0-0').toString();
            const [a, b] = key.split('-').map(n => Number(n));
            const peerId = senderId === a ? b : a;
            roomInfo = { kind: 'DIRECT', peerId };
        } else {
            // گروهی (از room.id یا room_id استفاده کن)
            const groupId =
                Number(m?.room?.id) ||
                Number((m as any).room_id ?? (m as any).groupId) ||
                NaN;
            if (!Number.isFinite(groupId)) {
                console.warn('[GW] mapMessageToWs: groupId not resolvable, falling back to room_id', {
                    room: m?.room,
                    room_id: (m as any).room_id,
                });
            }
            roomInfo = { kind: 'GROUP', groupId: groupId };
        }

        // --- attachment (normalize snake/camel) ---
        const attUrl =
            (m as any).attachment_url ??
            (m as any).attachmentUrl ??
            null;
        const attMime =
            (m as any).attachment_mime ??
            (m as any).attachmentMime ??
            null;
        const attSize =
            (m as any).attachment_size ??
            (m as any).attachmentSize ??
            null;

        // --- kind ---
        let kind: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';
        if ((m as any).kind) {
            kind = (m as any).kind;
        } else if (attUrl) {
            kind = typeof attMime === 'string' && attMime.startsWith('image/') ? 'IMAGE' : 'FILE';
        } else {
            kind = 'TEXT';
        }

        // --- text (ممکنه خالی یا undefined باشد) ---
        const textVal = (m as any).text;
        const text = typeof textVal === 'string' ? textVal : undefined;

        // --- createdAt → ISO ---
        // ورودی می‌تواند Date باشد یا string؛ هر دو را به ISO تبدیل کن
        const createdRaw =
            (m as any).created_at ??
            (m as any).createdAt ??
            null;

        let createdAtIso: string;
        if (createdRaw instanceof Date) {
            createdAtIso = createdRaw.toISOString();
        } else if (typeof createdRaw === 'string' && createdRaw.trim()) {
            const d = new Date(createdRaw);
            createdAtIso = Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
        } else {
            createdAtIso = new Date().toISOString();
        }

        const result: SavedMessage = {
            id: Number((m as any).id),
            room: roomInfo,
            senderId,
            senderName,
            kind,
            text,
            attachmentUrl: attUrl ?? null,
            createdAt: createdAtIso,
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

    // ChatGateway.handleReadFromHttp
    @OnEvent('chat.message.read')
    handleReadFromHttp(payload: {
        messageId: number;
        readerId: number;
        senderId: number;
        roomType: 'DIRECT' | 'SA_GROUP';
        roomId: number | null;
        saRootId: number | null;
        audienceUserIds: number[];
    }) {
        const { messageId, readerId, roomType, audienceUserIds, roomId } = payload;
        const evt = { messageId, readerId };

        if (roomType === 'DIRECT') {
            if (Array.isArray(audienceUserIds) && audienceUserIds.length === 2) {
                const [a, b] = audienceUserIds.slice().sort((x, y) => x - y);
                const roomName = this.dmRoom(a, b);
                this.server.to(roomName).emit('message:read', evt);
                this.emitToUsers(audienceUserIds, 'message:read', evt);
                console.log('[GW] HTTP_READ_OUT_DM', { roomName, evt });
            }
            return;
        }

        // SA_GROUP
        if (roomId) {
            const roomName = this.groupRoom(roomId);
            this.server.to(roomName).emit('message:read', evt);

            // ⬅️ فالبک: به UserRoom اعضای حاضر هم بفرست
            const memberUserIds = Array.from(this.roomMembers.get(roomName) ?? []);
            if (memberUserIds.length) this.emitToUsers(memberUserIds, 'message:read', evt);

            if (Array.isArray(audienceUserIds) && audienceUserIds.length) {
                this.emitToUsers(audienceUserIds, 'message:read', evt);
            }
            console.log('[GW] HTTP_READ_OUT_GRP', { roomName, evt, memberUserIds, audienceUserIds });
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
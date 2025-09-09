import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChatRoom } from './chat-room.entity';
import { ChatMembership } from './chat-membership.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatRead } from './chat-read.entity';
import { Users } from '../users/users.entity';

type SendMessageInput = {
  roomId: number;
  senderId: number;
  text?: string;
  kind?: 'TEXT' | 'IMAGE' | 'FILE';
  attachmentUrl?: string | null;
  attachmentSize?: number | null;
  attachmentMime?: string | null;
};

type LiteUser = { id: number; full_name: string; role_level: number };

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom) private readonly roomRepo: Repository<ChatRoom>,
    @InjectRepository(ChatMembership) private readonly memberRepo: Repository<ChatMembership>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ChatRead) private readonly readRepo: Repository<ChatRead>,
    @InjectRepository(Users) private readonly usersRepo: Repository<Users>,
    private readonly events: EventEmitter2,
  ) { }

  /* ================= Config / Limits ================= */

  private defaultMaxUploadMb() { return 10; }
  defaultUploadLimitBytes() { return this.defaultMaxUploadMb() * 1024 * 1024; }

  private async roomMaxUploadMb(room: ChatRoom | number) {
    const r = typeof room === 'number' ? await this.roomRepo.findOne({ where: { id: room } }) : room;
    if (!r) throw new NotFoundException('اتاق پیدا نشد');
    return r.max_upload_mb ?? this.defaultMaxUploadMb();
  }

  public async getRoomUploadLimitMb(roomId: number) {
    return this.roomMaxUploadMb(roomId);
  }

  /* ================= Helpers ================= */

  // عضویت بی‌قید و شرط: اگر اتاق هست، کاربر رو عضو می‌کنیم و true می‌دیم
  async canJoinRoom(userId: number, roomId: number): Promise<boolean> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) return false;
    await this.ensureMembership(room.id, userId);
    return true;
  }

  private async ensureMembership(roomId: number, userId: number) {
    try {
      const m = this.memberRepo.create({ room_id: roomId, user_id: userId });
      await this.memberRepo.save(m);
    } catch {
      // duplicate → ok
    }
  }

  // فقط خودت نباشی
  async isDirectAllowed(aId: number, bId: number): Promise<boolean> {
    return aId !== bId;
  }

  /* ================= Rooms ================= */

  // یک گروه عمومیِ واحد برای همهٔ کاربران (SA_GROUP با sa_root_user_id = null)
  async ensureSaGroupForUser(userId: number): Promise<ChatRoom> {
    let room = await this.roomRepo.findOne({
      where: { type: 'SA_GROUP', sa_root_user_id: null as any },
    });

    if (!room) {
      room = this.roomRepo.create({
        type: 'SA_GROUP',
        sa_root_user_id: null,
        title: 'گفتگوی عمومی',
        created_by: userId,
        max_upload_mb: null,
      });
      room = await this.roomRepo.save(room);
    }

    await this.ensureMembership(room.id, userId);
    return room;
  }

  // دایرکت بدون هیچ شرطی
  async ensureDirectRoom(aUserId: number, bUserId: number): Promise<ChatRoom> {
    if (!(await this.isDirectAllowed(aUserId, bUserId))) {
      throw new BadRequestException('چت با خودت ممکن نیست.');
    }

    const [x, y] = [Math.min(aUserId, bUserId), Math.max(aUserId, bUserId)];
    const key = `${x}-${y}`;

    let room = await this.roomRepo.findOne({ where: { type: 'DIRECT', direct_key: key } });
    if (!room) {
      room = this.roomRepo.create({
        type: 'DIRECT',
        direct_key: key,
        sa_root_user_id: null,
        title: null,
        created_by: aUserId,
        max_upload_mb: null,
      });
      room = await this.roomRepo.save(room);
    }

    await this.ensureMembership(room.id, aUserId);
    await this.ensureMembership(room.id, bUserId);

    return room;
  }

  // اتاق‌های عضویت کاربر
  async myRooms(userId: number) {
    const ms = await this.memberRepo.find({ where: { user_id: userId } });
    const roomIds = ms.map(m => m.room_id);
    if (!roomIds.length) return [];
    return this.roomRepo.find({ where: { id: In(roomIds) } });
  }

  // پیام‌های یک اتاق
  async roomMessages(roomId: number, requesterId: number, limit = 50, beforeId?: number) {
    const ok = await this.canJoinRoom(requesterId, roomId);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    // تغییر این خط: leftJoinAndSelect رو اضافه کنید
    const qb = this.msgRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender') // <-- این خط اضافه شد
      .where('m.room_id = :rid', { rid: roomId })
      .andWhere('m.deleted_at IS NULL')
      .orderBy('m.id', 'DESC')
      .limit(Math.min(limit, 200));
    if (beforeId) qb.andWhere('m.id < :bid', { bid: beforeId });

    const rows = await qb.getMany();

    // حالا باید داده‌ها رو برای فرانت آماده کنید و senderName رو اضافه کنید
    const result = rows.map(m => ({
      id: m.id,
      room_id: m.room_id,
      sender_id: m.sender_id,
      // این خط مهمه:
      senderName: m.sender?.full_name || `کاربر #${m.sender_id}`,
      kind: m.kind,
      text: m.text,
      attachment_url: m.attachment_url,
      attachment_mime: m.attachment_mime,
      attachment_size: m.attachment_size,
      created_at: m.created_at,
    }));

    return result.reverse(); // یا اینجا reverse کنید یا در فرانت
  }

  /* ================= Messages ================= */

  async sendMessage(input: SendMessageInput) {
    const { roomId, senderId } = input;
    const ok = await this.canJoinRoom(senderId, roomId);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    // چک سقف آپلود فقط در صورت فایل
    if (input.attachmentSize) {
      const limitMb = await this.roomMaxUploadMb(roomId);
      if (input.attachmentSize > limitMb * 1024 * 1024) {
        throw new BadRequestException(`حجم فایل بیش از حد مجاز (${limitMb}MB) است.`);
      }
    }

    const msg = this.msgRepo.create({
      room_id: roomId,
      sender_id: senderId,
      kind: input.kind ?? (input.attachmentUrl ? 'IMAGE' : 'TEXT'), // <-- اینجا
      text: input.text ?? null,
      attachment_url: input.attachmentUrl ?? null,
      attachment_size: input.attachmentSize ?? null,
      attachment_mime: input.attachmentMime ?? null,
      
    });
    const savedRow = await this.msgRepo.save(msg);

    const saved = await this.msgRepo.findOne({
      where: { id: savedRow.id },
      relations: ['sender', 'room'],
    });

    // رویداد برای گیت‌وی (bridge به Socket)
    if (saved && saved.room) {
      if (saved.room.type === 'SA_GROUP') {
        this.events.emit('chat.message.created', <const>{
          message: saved,
          roomType: 'SA_GROUP',
          saRootId: saved.room.sa_root_user_id, // null در مدل جدید
          audienceUserIds: [],                   // گیت‌وی خودش به Room برادکست می‌کنه
        });
      } else if (saved.room.type === 'DIRECT' && saved.room.direct_key) {
        const [a, b] = saved.room.direct_key.split('-').map(Number);
        this.events.emit('chat.message.created', <const>{
          message: saved,
          roomType: 'DIRECT',
          saRootId: null,
          audienceUserIds: [a, b],
        });
      }
    }

    return saved!;
  }

  async markRead(messageId: number, readerId: number) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId }, relations: ['room'] });
    if (!msg) throw new NotFoundException('پیام پیدا نشد');

    const ok = await this.canJoinRoom(readerId, msg.room_id);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    try {
      const r = this.readRepo.create({ message_id: messageId, reader_id: readerId });
      await this.readRepo.save(r);
    } catch { /* duplicate ok */ }

    // رویداد read
    if (msg.room.type === 'SA_GROUP') {
      this.events.emit('chat.message.read', <const>{
        messageId,
        readerId,
        senderId: msg.sender_id,
        roomType: 'SA_GROUP',
        saRootId: msg.room.sa_root_user_id, // null
        audienceUserIds: [],
      });
    } else if (msg.room.type === 'DIRECT' && msg.room.direct_key) {
      const [a, b] = msg.room.direct_key.split('-').map(Number);
      this.events.emit('chat.message.read', <const>{
        messageId,
        readerId,
        senderId: msg.sender_id,
        roomType: 'DIRECT',
        saRootId: null,
        audienceUserIds: [a, b],
      });
    }

    return { ok: true };
  }

  // لیست خوانندگان یک پیام
  async readersOfMessage(messageId: number, requesterId: number) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId }, relations: ['room'] });
    if (!msg) throw new NotFoundException('پیام پیدا نشد');

    const ok = await this.canJoinRoom(requesterId, msg.room_id);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    const reads = await this.readRepo.find({
      where: { message_id: messageId },
      relations: ['reader'],
      order: { read_at: 'ASC' },
    });

    return reads.map(r => ({
      id: r.reader_id,
      full_name: r.reader?.full_name,
      read_at: r.read_at,
    }));
  }

  // مپ خوانندگان چند پیام
  async readersMap(roomId: number, requesterId: number, msgIds: number[]) {
    const ok = await this.canJoinRoom(requesterId, roomId);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');
    if (!msgIds?.length) return {};

    const msgs = await this.msgRepo.find({ where: { id: In(msgIds) } });
    const validIds = msgs.filter(m => m.room_id === roomId).map(m => m.id);
    if (!validIds.length) return {};

    const reads = await this.readRepo.find({
      where: { message_id: In(validIds) },
      select: ['message_id', 'reader_id'],
      order: { read_at: 'ASC' },
    });

    const map: Record<number, number[]> = {};
    for (const r of reads) {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r.reader_id);
    }
    return map;
  }

  /* ================= Users ================= */

  // همهٔ یوزرها (به‌جز خودت) برای استارت چت
  async visibleUsers(userId: number): Promise<LiteUser[]> {
    const all = await this.usersRepo.find({
      select: { id: true, full_name: true, role_level: true } as any,
      order: { full_name: 'ASC' } as any,
    });
    return all.filter(u => u.id !== userId) as unknown as LiteUser[];
  }

  /* ================= Settings ================= */

  // هر عضو اتاق می‌تونه سقف آپلود رو تنظیم کنه
  async setRoomUploadLimit(roomId: number, requesterId: number, mb: number | null) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('اتاق پیدا نشد');

    // مطمئن شو درخواست‌دهنده عضو اتاقه (وگرنه عضو کن)
    const ok = await this.canJoinRoom(requesterId, roomId);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    room.max_upload_mb = mb; // null ⇒ پیش‌فرض ۱۰
    await this.roomRepo.save(room);

    const maxBytes = (room.max_upload_mb ?? this.defaultMaxUploadMb()) * 1024 * 1024;
    if (room.type === 'SA_GROUP') {
      this.events.emit('chat.room.upload_limit_updated', <const>{
        roomId: room.id,
        maxBytes,
        roomType: 'SA_GROUP',
        saRootId: room.sa_root_user_id,
        audienceUserIds: [],
      });
    } else if (room.type === 'DIRECT' && room.direct_key) {
      const [a, b] = room.direct_key.split('-').map(Number);
      this.events.emit('chat.room.upload_limit_updated', <const>{
        roomId: room.id,
        maxBytes,
        roomType: 'DIRECT',
        saRootId: null,
        audienceUserIds: [a, b],
      });
    }

    return { ok: true, max_upload_mb: room.max_upload_mb ?? this.defaultMaxUploadMb() };
  }

  /* ================= (اختیاری) سازگاری با API قدیمی ================= */

  // اگر جایی هنوز از این استفاده می‌کنی، برگردون اتاق‌های عضویت SA
  async roomsForSuperAdmin(saId: number): Promise<ChatRoom[]> {
    // نسخه‌ی ساده: همون myRooms برای saId
    return this.myRooms(saId);
  }
}

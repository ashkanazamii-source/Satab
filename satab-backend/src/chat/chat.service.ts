import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChatRoom } from './chat-room.entity';
import { ChatMembership } from './chat-membership.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatRead } from './chat-read.entity';
import { Users } from '../users/users.entity';
import { OnEvent } from '@nestjs/event-emitter';
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
  async findMessageById(messageId: number): Promise<ChatMessage | null> {
    return this.msgRepo.findOne({ where: { id: messageId } });
  }
  private defaultMaxUploadMb() { return 10; }
  defaultUploadLimitBytes() { return this.defaultMaxUploadMb() * 1024 * 1024; }

  private async roomMaxUploadMb(room: ChatRoom | number) {
    const r = typeof room === 'number' ? await this.roomRepo.findOne({ where: { id: room } }) : room;
    if (!r) throw new NotFoundException('اتاق پیدا نشد');
    return r.max_upload_mb ?? this.defaultMaxUploadMb();
  }
  async getRoomById(roomId: number) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('اتاق پیدا نشد');
    return room;
  }
  public async getRoomUploadLimitMb(roomId: number) {
    return this.roomMaxUploadMb(roomId);
  }

  /* ================= Helpers ================= */

  // عضویت بی‌قید و شرط: اگر اتاق هست، کاربر رو عضو می‌کنیم و true می‌دیم
  async canJoinRoom(userId: number, roomId: number): Promise<boolean> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) return false;

    if (room.type === 'DIRECT') {
      const isMember = await this.memberRepo.findOne({
        where: { room_id: roomId, user_id: userId },
      });
      return !!isMember;
    }

    if (room.type === 'SA_GROUP') {
      if (!room.sa_root_user_id) return false;

      // 👇 اگر مدیرکل است، اجازه بده و عضو کن
      const me = await this.usersRepo.findOne({
        where: { id: userId },
        select: { id: true, role_level: true } as any,
      });
      if (me?.role_level === 1) {
        await this.ensureMembership(room.id, userId);
        return true;
      }

      // در غیر این صورت: فقط زیرمجموعهٔ همان SA
      const userSaId = await this.getNearestSuperAdminId(userId);
      const allowed = userSaId === room.sa_root_user_id;
      if (allowed) await this.ensureMembership(room.id, userId);
      return allowed;
    }

    return false;
  }


  async toggleRoomLock(roomId: number, requester: Users) {
    if (requester.role_level !== 2) {
      throw new ForbiddenException('فقط مدیران اصلی می‌توانند گروه را قفل کنند.');
    }

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('اتاق پیدا نشد.');
    }

    if (room.type !== 'SA_GROUP') {
      throw new BadRequestException('فقط گروه‌ها را می‌توان قفل کرد.');
    }

    room.is_locked = !room.is_locked;
    const updatedRoom = await this.roomRepo.save(room);

    // Emit event for the gateway to broadcast to all clients in the room
    this.events.emit('chat.room.updated', {
      room: updatedRoom,
    });

    return updatedRoom;
  }
  async getRoomMembers(roomId: number, requesterId: number): Promise<LiteUser[]> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('اتاق پیدا نشد.');

    const ok = await this.canJoinRoom(requesterId, roomId);
    if (!ok) throw new ForbiddenException('اجازهٔ مشاهدهٔ اعضای این اتاق را ندارید.');

    const memberships = await this.memberRepo.find({
      where: { room_id: roomId },
      select: ['user_id'],
    });
    if (!memberships.length) return [];

    const memberIds = memberships.map(m => m.user_id);
    const members = await this.usersRepo.find({
      where: { id: In(memberIds) },
      select: ['id', 'full_name', 'role_level'],
      order: { full_name: 'ASC' },
    });
    return members as LiteUser[];
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

  // نزدیک‌ترین سوپرادمین در زنجیره والدین (از خودِ کاربر شروع می‌کنیم)
  private async getNearestSuperAdminId(userId: number): Promise<number | null> {
    let current = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['parent'],
      select: { id: true, role_level: true } as any,
    });
    if (!current) return null;

    // اگر خودش سوپرادمین است، خودش ریشه‌ی SA محسوب می‌شود
    if (current.role_level === 2) return current.id;

    const seen = new Set<number>([current.id]);
    while (current?.parent) {
      const p = await this.usersRepo.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
        select: { id: true, role_level: true } as any,
      });
      if (!p || seen.has(p.id)) break;
      if (p.role_level === 2) return p.id;   // ← به‌محض دیدن سطح ۲، همینه
      seen.add(p.id);
      current = p;
    }
    return null;
  }



  async ensureSaGroupForUser(userId: number): Promise<ChatRoom | null> {
    let saId = await this.getNearestSuperAdminId(userId);

    // fallback: اگر خود کاربر سوپرادمین است، خودش ریشه محسوب شود
    if (!saId) {
      const me = await this.usersRepo.findOne({ where: { id: userId }, select: ['id', 'role_level'] as any });
      if (me && me.role_level === 2) saId = me.id;
    }
    if (!saId) return null;

    const room = await this.ensureSaGroupForRoot(saId);
    await this.ensureMembership(room.id, userId);

    if (userId === saId) {
      const descendants = await this.getDescendantIds(saId);
      const allMemberIds = Array.from(new Set<number>([saId, ...descendants]));
      await this.memberRepo
        .createQueryBuilder()
        .insert()
        .values(allMemberIds.map(uid => ({ room_id: room.id, user_id: uid })))
        .orIgnore()
        .execute();
    }
    return room;
  }


  private async ensureManagersInRoom(roomId: number) {
    const managers = await this.usersRepo.find({
      where: { role_level: 1 },
      select: { id: true } as any,
    });
    for (const m of managers) {
      await this.ensureMembership(roomId, m.id);
    }
  }


  async ensureDirectRoom(aUserId: number, bUserId: number): Promise<ChatRoom> {
    if (!(await this.isDirectAllowed(aUserId, bUserId))) {
      throw new BadRequestException('Cannot chat with yourself.');
    }
    const [x, y] = [Math.min(aUserId, bUserId), Math.max(aUserId, bUserId)];
    const key = `${x}-${y}`;
    let room = await this.roomRepo.findOne({ where: { type: 'DIRECT', direct_key: key } });
    if (!room) {
      room = this.roomRepo.create({
        type: 'DIRECT',
        direct_key: key,
        created_by: aUserId,
      });
      room = await this.roomRepo.save(room);
    }
    await this.ensureMembership(room.id, aUserId);
    await this.ensureMembership(room.id, bUserId);
    return room;
  }

  /**
   * MODIFIED FUNCTION
   * Gets the user's rooms, including their specific super admin group.
   */
  async myRooms(userId: number) {
    const me = await this.usersRepo.findOne({ where: { id: userId }, select: ['id', 'role_level'] as any });

    // 👇 مدیرکل: باید عضو همهٔ گروه‌های SA باشد و آن‌ها را ببیند
    if (me?.role_level === 1) {
      // همهٔ سوپرادمین‌ها
      const sas = await this.usersRepo.find({ where: { role_level: 2 }, select: ['id'] as any });

      const saRooms: ChatRoom[] = [];
      for (const sa of sas) {
        const room = await this.ensureSaGroupForRoot(sa.id);
        await this.ensureMembership(room.id, userId); // خودِ مدیرکل
        // (تابع ensureSaGroupForRoot خودش ensureManagersInRoom را صدا زده)
        saRooms.push(room);
      }

      // دایرکت‌هایی که عضو است
      const memberships = await this.memberRepo.find({
        where: { user_id: userId },
        select: ['room_id'],
      });
      const memberRoomIds = memberships.map(m => m.room_id);

      let directRooms: ChatRoom[] = [];
      if (memberRoomIds.length > 0) {
        directRooms = await this.roomRepo.find({
          where: { id: In(memberRoomIds), type: 'DIRECT' },
        });
      }

      const all = new Map<number, ChatRoom>();
      saRooms.forEach(r => all.set(r.id, r));
      directRooms.forEach(r => all.set(r.id, r));
      return Array.from(all.values());
    }

    // کاربرهای غیر مدیرکل: منطق قبلی
    const saGroup = await this.ensureSaGroupForUser(userId);

    const memberships = await this.memberRepo.find({
      where: { user_id: userId },
      select: ['room_id'],
    });
    const memberRoomIds = memberships.map(m => m.room_id);

    let otherRooms: ChatRoom[] = [];
    if (memberRoomIds.length > 0) {
      otherRooms = await this.roomRepo.find({
        where: { id: In(memberRoomIds), type: 'DIRECT' },
      });
    }

    const allRooms = new Map<number, ChatRoom>();
    if (saGroup) allRooms.set(saGroup.id, saGroup);
    otherRooms.forEach(room => allRooms.set(room.id, room));
    return Array.from(allRooms.values());
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


  async sendMessage(input: SendMessageInput) {
    const { roomId, senderId } = input;

    // --- START: CORRECTED CODE ---
    // به جای فراخوانی‌های جداگانه، اطلاعات اتاق و کاربر را یکجا و بهینه‌تر می‌گیریم
    const [room, sender, ok] = await Promise.all([
      this.roomRepo.findOne({ where: { id: roomId } }),
      this.usersRepo.findOne({ where: { id: senderId } }),
      this.canJoinRoom(senderId, roomId),
    ]);

    // بررسی می‌کنیم که اتاق و کاربر وجود داشته باشند
    if (!ok || !room || !sender) {
      throw new NotFoundException('اتاق یا کاربر پیدا نشد.');
    }

    // این شرط امنیتی کلیدی است:
    // اگر اتاق قفل است، فقط سوپر ادمین (نقش ۲) می‌تواند پیام ارسال کند
    if (room.is_locked && sender.role_level !== 2) {
      throw new ForbiddenException('این گروه قفل است و فقط مدیر می‌تواند پیام ارسال کند.');
    }
    // --- END: CORRECTED CODE ---

    // چک سقف آپلود فقط در صورت فایل
    if (input.attachmentSize) {
      // بهینه‌سازی: از آبجکت room که از قبل گرفته‌ایم استفاده می‌کنیم
      const limitMb = await this.roomMaxUploadMb(room);
      if (input.attachmentSize > limitMb * 1024 * 1024) {
        throw new BadRequestException(`حجم فایل بیش از حد مجاز (${limitMb}MB) است.`);
      }
    }

    const msg = this.msgRepo.create({
      room_id: roomId,
      sender_id: senderId,
      kind: input.kind ?? (input.attachmentUrl ? 'IMAGE' : 'TEXT'),
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
          saRootId: saved.room.sa_root_user_id,
          audienceUserIds: [],
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
      this.events.emit('chat.message.read', {
        messageId,
        readerId,
        senderId: msg.sender_id,
        roomType: 'SA_GROUP',
        roomId: msg.room_id,                 // ⬅️ اضافه شد
        saRootId: msg.room.sa_root_user_id,
        audienceUserIds: [],
      });
    } else if (msg.room.type === 'DIRECT' && msg.room.direct_key) {
      const [a, b] = msg.room.direct_key.split('-').map(Number);
      this.events.emit('chat.message.read', {
        messageId,
        readerId,
        senderId: msg.sender_id,
        roomType: 'DIRECT',
        roomId: msg.room_id,              // ⬅️ (اختیاری اما مفید)
        saRootId: null,
        audienceUserIds: [a, b],
      });
    }
    console.log('[BE] READ_SAVED', { messageId, readerId, roomType: msg.room.type, roomId: msg.room_id });

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

  // chat.service.ts (افزودنی‌ها)





  // ---------- کمکی: اطمینان از وجود گروه SA برای یک سوپرادمین ----------


  // ---------- اصلی: سینک اعضای گروه برای یک سوپرادمین ----------
  public async syncOneSaGroup(saId: number, opts?: { removeStrangers?: boolean }) {
    const sa = await this.usersRepo.findOne({ where: { id: saId }, relations: ['parent'], select: ['id', 'role_level', 'full_name'] as any });
    if (!sa || sa.role_level !== 2) throw new BadRequestException('شناسه ورودی، سوپرادمین نیست.');

    const room = await this.ensureSaGroupForRoot(saId);

    const descendants = await this.getDescendantIds(saId);
    const memberIds = Array.from(new Set<number>([saId, ...descendants]));

    await this.memberRepo
      .createQueryBuilder()
      .insert()
      .values(memberIds.map(uid => ({ room_id: room.id, user_id: uid })))
      .orIgnore()
      .execute();

    // 👇 مدیرکل‌ها را هم عضو کن (idempotent)
    await this.ensureManagersInRoom(room.id);

    if (opts?.removeStrangers) {
      const existing = await this.memberRepo.find({ where: { room_id: room.id }, select: ['user_id'] });
      const want = new Set([...memberIds, ...(await this.usersRepo.find({ where: { role_level: 1 }, select: { id: true } as any })).map(m => m.id)]);
      const strangers = existing.map(e => e.user_id).filter(uid => !want.has(uid));
      if (strangers.length) {
        await this.memberRepo.delete({ room_id: room.id, user_id: In(strangers) });
      }
    }

    this.events.emit('chat.room.updated', { room });
    return { ok: true, roomId: room.id, members: memberIds.length };
  }


  // ---------- همهٔ SAها را سینک کن ----------
  public async syncAllSaGroups(opts?: { removeStrangers?: boolean; fixLegacyRooms?: boolean }) {
    // (اختیاری) ابتدا گروه‌های legacy را که sa_root_user_id=null دارند، بر اساس created_by=SA مقداردهی کن
    if (opts?.fixLegacyRooms) {
      const legacies = await this.roomRepo.find({ where: { type: 'SA_GROUP', sa_root_user_id: null as any } });
      if (legacies.length) {
        const saIds = legacies.map(r => r.created_by).filter(Boolean) as number[];
        const saSet = new Set(saIds);
        for (const saId of saSet) {
          await this.ensureSaGroupForRoot(saId);
        }
      }
    }

    // همهٔ SAها
    const sas = await this.usersRepo.find({
      where: { role_level: 2 },
      select: ['id'] as any,
    });

    const results: any[] = [];
    for (const sa of sas) {
      const r = await this.syncOneSaGroup(sa.id, { removeStrangers: opts?.removeStrangers });
      results.push({ saId: sa.id, ...r });
    }
    return { ok: true, synced: results.length, results };
  }

  // ---------- لیسنر رویدادها: ساخته شدن/تغییر والد کاربر ----------
  @OnEvent('users.created')
  async onUserCreated(payload: { userId: number }) {
    // کاربر جدید را به گروه SA ریشه‌ی خودش اضافه کن (اگر ریشه SA دارد)
    const room = await this.ensureSaGroupForUser(payload.userId); // همان متد قبلی‌ات
    if (room) this.events.emit('chat.room.updated', { room });
  }

  @OnEvent('users.parent_changed')
  async onUserParentChanged(payload: { userId: number }) {
    // فقط خود کاربر را جابه‌جا نکن؛ کل زیر درختش هم باید migrate شود:
    // 1) اول خود کاربر
    const room = await this.ensureSaGroupForUser(payload.userId);
    if (room) this.events.emit('chat.room.updated', { room });

    // 2) سپس همهٔ فرزندانش به‌صورت بازگشتی
    const children = await this.usersRepo.find({ where: { parent: { id: payload.userId } }, select: ['id'] as any });
    for (const c of children) {
      await this.onUserParentChanged({ userId: c.id }); // بازگشتی
    }
  }








  // ChatService

  // SA ریشه‌ی یک کاربر را بده (اگر نداشت null)
  private async getRootSuperAdminId(userId: number): Promise<number | null> {
    let current = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['parent'],
      select: { id: true, role_level: true } as any,
    });
    if (!current) return null;

    const seen = new Set<number>([current.id]);
    while (current?.parent) {
      const p = await this.usersRepo.findOne({
        where: { id: current.parent.id },
        relations: ['parent'],
        select: { id: true, role_level: true } as any,
      });
      if (!p || seen.has(p.id)) break;
      seen.add(p.id);
      current = p;
    }
    return current?.role_level === 2 ? current.id : null;
  }

  // همه‌ی زیرمجموعه‌های یک ریشه (BFS)
  private async getDescendantIds(rootId: number): Promise<number[]> {
    const out: number[] = [];
    const q: number[] = [rootId];
    const seen = new Set<number>([rootId]);

    while (q.length) {
      const batch = q.splice(0, 200);
      const kids = await this.usersRepo.find({
        where: batch.map(id => ({ parent: { id } })),
        relations: ['parent'],
        select: { id: true } as any,
      });
      for (const k of kids) {
        if (!seen.has(k.id)) {
          seen.add(k.id);
          out.push(k.id);
          q.push(k.id);
        }
      }
    }
    return out;
  }

  // اگر گروه SA با sa_root_user_id=saId نبود، بساز (یا legacy را adopt کن)
  private async ensureSaGroupForRoot(saId: number): Promise<ChatRoom> {
    let room = await this.roomRepo.findOne({ where: { type: 'SA_GROUP', sa_root_user_id: saId } });
    if (room) {
      // 👇 مطمئن شو مدیرکل‌ها عضو‌اند (idempotent)
      await this.ensureManagersInRoom(room.id);
      return room;
    }

    const sa = await this.usersRepo.findOne({ where: { id: saId }, select: ['id', 'full_name'] as any });
    if (!sa) throw new NotFoundException('SA not found');

    const legacy = await this.roomRepo.findOne({
      where: { type: 'SA_GROUP', sa_root_user_id: null as any, created_by: saId },
    });
    if (legacy) {
      legacy.sa_root_user_id = saId;
      legacy.title = legacy.title || `گروه ${sa.full_name}`;
      room = await this.roomRepo.save(legacy);
      // 👇
      await this.ensureManagersInRoom(room.id);
      return room;
    }

    room = this.roomRepo.create({
      type: 'SA_GROUP',
      sa_root_user_id: saId,
      title: `گروه ${sa.full_name}`,
      created_by: saId,
      is_locked: false,
    });
    room = await this.roomRepo.save(room);

    // 👇 مدیرکل‌ها را عضو کن
    await this.ensureManagersInRoom(room.id);

    return room;
  }







  private toClientMessage(m: ChatMessage) {
    return {
      id: m.id,
      room_id: m.room_id,
      sender_id: m.sender_id,
      senderName: (m as any).sender?.full_name || `کاربر #${m.sender_id}`,
      kind: m.kind,
      text: m.text,
      attachment_url: m.attachment_url,
      attachment_mime: m.attachment_mime,
      attachment_size: m.attachment_size,
      created_at: m.created_at,
    };
  }

  async getPinnedMessage(roomId: number, requesterId: number) {
    const ok = await this.canJoinRoom(requesterId, roomId);
    if (!ok) throw new NotFoundException('اتاق پیدا نشد');

    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ['pinned_message', 'pinned_message.sender'],
    });
    if (!room) throw new NotFoundException('اتاق پیدا نشد');
    if (!room.pinned_message) return null;
    return this.toClientMessage(room.pinned_message);
  }

  // قانون دسترسی: DIRECT = هر دو طرف؛ GROUP = فقط نقش‌های 1 و 2
  private ensurePinPermission(room: ChatRoom, me: Users) {
    if (room.type === 'DIRECT') return; // آزاد برای هر دو سمت
    if (me.role_level === 1 || me.role_level === 2) return;
    throw new ForbiddenException('اجازهٔ پین این اتاق را ندارید.');
  }

  async pinRoomMessage(roomId: number, messageId: number, me: Users) {
    const [room, ok] = await Promise.all([
      this.roomRepo.findOne({ where: { id: roomId } }),
      this.canJoinRoom(me.id, roomId),
    ]);
    if (!room || !ok) throw new NotFoundException('اتاق پیدا نشد');

    this.ensurePinPermission(room, me);

    const msg = await this.msgRepo.findOne({
      where: { id: messageId, room_id: roomId },
      relations: ['sender'],
    });
    if (!msg) throw new NotFoundException('پیام پیدا نشد');

    room.pinned_message_id = msg.id;
    await this.roomRepo.save(room);

    const payload = { room: { id: room.id }, message: this.toClientMessage(msg) };
    this.events.emit('chat.room.pin.changed', payload);
    this.events.emit('room:pin.changed', payload); // برای سازگاری نام رویداد

    return this.toClientMessage(msg);
  }

  async unpinRoomMessage(roomId: number, me: Users) {
    const [room, ok] = await Promise.all([
      this.roomRepo.findOne({ where: { id: roomId } }),
      this.canJoinRoom(me.id, roomId),
    ]);
    if (!room || !ok) throw new NotFoundException('اتاق پیدا نشد');

    this.ensurePinPermission(room, me);

    room.pinned_message_id = null;
    await this.roomRepo.save(room);

    const payload = { room: { id: room.id }, message: null };
    this.events.emit('chat.room.pin.changed', payload);
    this.events.emit('room:pin.changed', payload);

    return { ok: true };
  }

}

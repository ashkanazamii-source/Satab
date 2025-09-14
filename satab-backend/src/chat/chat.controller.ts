// src/chat/chat.controller.ts
import {
  Controller, Get, Post, Param, ParseIntPipe, Body, Delete,
  UploadedFile, UseInterceptors, BadRequestException, Query, Patch,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileTypeFromBuffer } from 'file-type';

import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Users } from '../users/users.entity';
import { UseGuards } from '@nestjs/common';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    @InjectRepository(Users) private readonly usersRepo: Repository<Users>,
  ) { }
  @Patch('rooms/:id/toggle-lock')
  async toggleLock(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
  ) {
    return this.chat.toggleRoomLock(roomId, me);
  }
  // ——— لیست همهٔ کاربرها برای استارت چت (بدون هیچ فیلتر نقشی/دامنه‌ای)
  @Get('visible-users')
  async visibleUsers(@CurrentUser() me: Users) {
    const users = await this.usersRepo.find({
      select: { id: true, full_name: true, role_level: true } as any,
      order: { full_name: 'ASC' } as any,
    });
    // اگر خودت رو نمی‌خوای ببینی، اینجا حذفش می‌کنیم
    return users.filter(u => u.id !== me.id);
  }
  @Get('rooms/:id/members')
  async getRoomMembers(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
  ) {
    return this.chat.getRoomMembers(roomId, me.id);
  }
  // ——— اتاق‌های من (همون چیزی که سرویس می‌ده؛ Membership مبناست)
  @Get('rooms')
  async myRooms(@CurrentUser() me: Users) {
    return this.chat.myRooms(me.id);
  }

  // ——— پیام‌های یک اتاق (ساده)
  @Get('rooms/:id/messages')
  async roomMessages(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
    @Query('limit') limit?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.chat.roomMessages(
      roomId,
      me.id,
      limit ? +limit : 50,
      beforeId ? +beforeId : undefined,
    );
  }
  // ChatController
  @Post('rooms/:id/readers-map')
  async readersMapPost(
    @Param('id', ParseIntPipe) roomId: number,
    @Body() body: { ids: number[] },
    @CurrentUser() me: Users,
  ) {
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
    return this.chat.readersMap(roomId, me.id, ids);
  }

  // ——— ارسال متن به اتاق (بدون شرط نقش/دامنه)
  @Post('rooms/:id/messages')
  async sendText(
    @Param('id', ParseIntPipe) roomId: number,
    @Body() body: { text?: string },
    @CurrentUser() me: Users,
  ) {
    const text = (body.text || '').trim();
    if (!text) throw new BadRequestException('متن خالی است');
    return this.chat.sendMessage({ roomId, senderId: me.id, text, kind: 'TEXT' });
  }

  // ——— آپلود تصویر داخل اتاق (فقط اعتبارسنجی فایل و سقف حجم)
  @Post('rooms/:id/messages/image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async sendImage(
    @Param('id', ParseIntPipe) roomId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() me: Users,
  ) {
    if (!file) throw new BadRequestException('فایل ارسال نشده');

    const sniff = await fileTypeFromBuffer(file.buffer);
    if (!sniff) throw new BadRequestException('نوع فایل ناشناخته است');
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(sniff.mime)) throw new BadRequestException('فقط تصویر مجاز است');

    const limitMb = await this.chat.getRoomUploadLimitMb(roomId);
    if (file.size > limitMb * 1024 * 1024) {
      throw new BadRequestException(`حجم فایل بیش از حد مجاز (${limitMb}MB)`);
    }

    const dir = path.resolve(process.cwd(), 'uploads', 'chat', String(roomId));
    await fs.mkdir(dir, { recursive: true });
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.${sniff.ext}`;
    await fs.writeFile(path.join(dir, filename), file.buffer);
    const url = `/uploads/chat/${roomId}/${filename}`;

    return this.chat.sendMessage({
      roomId,
      senderId: me.id,
      kind: 'IMAGE',
      attachmentUrl: url,
      attachmentSize: file.size,
      attachmentMime: sniff.mime,
    });
  }

  // ——— ساخت/گرفتن دایرکت با هر کاربری و (اختیاری) ارسال متن اول
  @Post('direct/:peerId')
  async sendDirect(
    @Param('peerId', ParseIntPipe) peerId: number,
    @Body() body: { text?: string } = {} as any,   // 👈 نال‌سیف
    @CurrentUser() me: Users,
  ) {
    const room = await this.chat.ensureDirectRoom(me.id, peerId);
    const text = (body?.text ?? '').trim();        // 👈 نال‌سیف

    if (!text) {
      return { ok: true, room_id: room.id, room }; // 👈 یکنواخت
    }

    const message = await this.chat.sendMessage({
      roomId: room.id,
      senderId: me.id,
      text,
      kind: 'TEXT',
    });
    return { ok: true, room_id: room.id, room, message };
  }
  @Get('rooms/:id')
  async getRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
  ) {
    const ok = await this.chat.canJoinRoom(me.id, roomId);
    if (!ok) throw new BadRequestException('اجازه دسترسی به این اتاق را ندارید.');
    return this.chat.getRoomById(roomId);
  }

  @Post('rooms/:id/pin')
  async pinRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @Body() body: { messageId: number },
    @CurrentUser() me: Users,
  ) {
    const mid = Number(body?.messageId);
    if (!Number.isFinite(mid)) throw new BadRequestException('messageId نامعتبر است');
    return this.chat.pinRoomMessage(roomId, mid, me);
  }

  @Delete('rooms/:id/pin')
  async unpinRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
  ) {
    return this.chat.unpinRoomMessage(roomId, me);
  }

  @Get('rooms/:id/pin')
  async getRoomPin(
    @Param('id', ParseIntPipe) roomId: number,
    @CurrentUser() me: Users,
  ) {
    return this.chat.getPinnedMessage(roomId, me.id);
  }

  // ——— مارک‌کردن خواندن پیام
  @Post('messages/:id/read')
  async markRead(@Param('id', ParseIntPipe) messageId: number, @CurrentUser() me: Users) {
    return this.chat.markRead(messageId, me.id);
  }

  // ——— لیست خوانندگان یک پیام
  @Get('messages/:id/readers')
  async readers(@Param('id', ParseIntPipe) messageId: number, @CurrentUser() me: Users) {
    return this.chat.readersOfMessage(messageId, me.id);
  }

  // ——— مپِ خوانندگان برای چند پیام (برای تیک‌ها)
  @Get('rooms/:id/readers-map')
  async readersMap(
    @Param('id', ParseIntPipe) roomId: number,
    @Query('ids') idsCsv: string,
    @CurrentUser() me: Users,
  ) {
    const ids = (idsCsv || '')
      .split(',')
      .map(s => +s.trim())
      .filter(n => Number.isFinite(n));
    return this.chat.readersMap(roomId, me.id, ids);
  }

  // ——— تغییر سقف آپلود (اجازه برای همه؛ اگر خواستی می‌تونی بعداً محدودش کنی)
  @Patch('rooms/:id/settings')
  async setRoomLimit(
    @Param('id', ParseIntPipe) roomId: number,
    @Body() body: { max_upload_mb: number | null },
    @CurrentUser() me: Users,
  ) {
    const mb = body.max_upload_mb == null ? null : Math.max(1, Math.floor(body.max_upload_mb));
    return this.chat.setRoomUploadLimit(roomId, me.id, mb);
  }

  // ——— (اختیاری) اگر هنوز جایی می‌خوای اتاق‌های یک SA خاص رو ببینی،
  // دیگه گارد/ACL نداره؛ فقط پاس می‌دیم به سرویس.
  @Get('rooms/for-sa/:saId')
  async roomsForSA(@Param('saId', ParseIntPipe) saId: number) {
    return this.chat.roomsForSuperAdmin(saId);
  }
}

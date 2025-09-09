import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { Users } from '../users/users.entity';
import { LogQueryDto } from '../dto/log-query.dto';
import { AuditTopic } from './audit-topics';
import { humanizeAuditRow } from './audit.humanize';

/** فقط این موضوعات ذخیره می‌شوند (whitelist) */
const ALLOWED_TOPICS = new Set<AuditTopic>([
  AuditTopic.USER_CREATE,
  AuditTopic.USER_UPDATE,
  AuditTopic.USER_DELETE,
  AuditTopic.LOGIN,
  AuditTopic.LOGOUT,
  AuditTopic.PERMISSION_GRANT,
  AuditTopic.PERMISSION_REVOKE,
  AuditTopic.PERMISSION_UPDATE,
  AuditTopic.PERMISSION_SYNC,
  AuditTopic.VEHICLE_CREATE,
  //AuditTopic.VEHICLE_UPDATE,
  AuditTopic.VEHICLE_DELETE,
  AuditTopic.DEVICE_BIND,
  AuditTopic.DEVICE_UNBIND,
  AuditTopic.POLICY_UPDATE,
  AuditTopic.COUNTRY_POLICY_UPDATE,
  AuditTopic.USER_CHANGE_ROLE,
]);

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logRepo: Repository<AuditLog>,
    @InjectRepository(Users) private readonly userRepo: Repository<Users>,
  ) { }

  /** تصمیم‌گیری برای ذخیره‌کردن لاگ */
  private shouldPersist(args: AuditLogInput): boolean {
    // 1) هر نوع لاگ درخواست HTTP کلاً ذخیره نشود (فرقی ندارد status چند باشد)
    if (args.topic === AuditTopic.HTTP_REQUEST) return false;

    // 2) لاگ‌های فنی ذخیره نشوند
    if (
      args.topic === AuditTopic.ENTITY_INSERT ||
      args.topic === AuditTopic.ENTITY_UPDATE ||
      args.topic === AuditTopic.ENTITY_REMOVE ||
      args.topic === AuditTopic.EXCEPTION
    ) {
      return false;
    }

    // 3) فقط whitelist
    return ALLOWED_TOPICS.has(args.topic);
  }

  /** محاسبهٔ آی‌دی‌های دامنهٔ کاربر (بالادست/پایین‌دست + خودش) */
  private async getScopeUserIds(currentUserId: number): Promise<number[]> {
    try {
      const rows = await this.userRepo.query(
        `
        WITH RECURSIVE
        descendants AS (
          SELECT id, parent_id FROM users WHERE id = $1
          UNION ALL
          SELECT u.id, u.parent_id FROM users u JOIN descendants d ON u.parent_id = d.id
        ),
        ancestors AS (
          SELECT id, parent_id FROM users WHERE id = $1
          UNION ALL
          SELECT u.id, u.parent_id FROM users u JOIN ancestors a ON a.parent_id = u.id
        ),
        scope AS (
          SELECT id FROM descendants
          UNION
          SELECT id FROM ancestors
        )
        SELECT id FROM scope;
      `,
        [currentUserId],
      );
      return rows.map((r: any) => Number(r.id));
    } catch {
      // fallback: پایین‌دستی‌ها
      const desc = new Set<number>([currentUserId]);
      let q = [currentUserId];
      while (q.length) {
        const batch = await this.userRepo.find({
          where: { parent: { id: In(q) } },
          select: { id: true } as any,
        });
        const next: number[] = [];
        for (const u of batch) if (!desc.has(u.id)) { desc.add(u.id); next.push(u.id); }
        q = next;
      }
      // fallback: بالادستی‌ها
      const anc = new Set<number>();
      let cur = await this.userRepo.findOne({ where: { id: currentUserId }, relations: ['parent'] });
      while (cur?.parent) {
        if (anc.has(cur.parent.id)) break;
        anc.add(cur.parent.id);
        cur = await this.userRepo.findOne({ where: { id: cur.parent.id }, relations: ['parent'] });
      }
      return Array.from(new Set<number>([...desc, ...anc]));
    }
  }

  /** واکشی لاگ‌ها با فیلترها */
  async findAll(currentUser: Users, dto: LogQueryDto) {
    if (!(currentUser.role_level >= 1 && currentUser.role_level <= 5)) {
      throw new ForbiddenException('اجازهٔ مشاهدهٔ لاگ‌ها را ندارید.');
    }


    const scopeIds = await this.getScopeUserIds(currentUser.id);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .leftJoinAndSelect('log.target_user', 'target')
      .orderBy('log.created_at', 'DESC')
      .take(limit)
      .skip(skip);

    const topics = normalizeTopics(dto.topic);
    if (topics.length) {
      qb.andWhere('log.topic::text IN (:...topics)', { topics }); // ✅
    }
    // مدیرکل (role 1): بدون محدودیت دامنه؛ بقیه: فقط در دامنهٔ خودش
    if (currentUser.role_level !== 1) {
      qb.andWhere('(log.actor_id IN (:...ids) OR log.target_user_id IN (:...ids))', { ids: scopeIds });

      if (dto.actor_id && !scopeIds.includes(dto.actor_id)) {
        throw new ForbiddenException('actor خارج از محدودهٔ شماست');
      }
      if (dto.target_user_id && !scopeIds.includes(dto.target_user_id)) {
        throw new ForbiddenException('target خارج از محدودهٔ شماست');
      }
    }

    if (dto.actor_id) qb.andWhere('log.actor_id = :aid', { aid: dto.actor_id });
    if (dto.target_user_id) qb.andWhere('log.target_user_id = :tid', { tid: dto.target_user_id });
    //if (dto.topic?.length) qb.andWhere('log.topic IN (:...topics)', { topics: dto.topic });

    if (dto.q?.trim()) {
      qb.andWhere(`(log.message ILIKE :qq OR CAST(log.metadata AS TEXT) ILIKE :qq)`, {
        qq: `%${dto.q.trim()}%`,
      });
    }
    if (dto.from) qb.andWhere('log.created_at >= :from', { from: dto.from });
    if (dto.to) qb.andWhere('log.created_at <= :to', { to: dto.to });

    // داده‌های قدیمی: لاگ‌های درخواست (event=REQUEST) و پیام‌هایی که با «درخواست …» شروع می‌شوند نمایش داده نشوند
    qb.andWhere(`
      (log.event IS NULL OR log.event <> 'REQUEST')
      AND (log.message IS NULL OR log.message !~* '^\\s*درخواست\\b')
    `);

    const [items, total] = await qb.getManyAndCount();
    const itemsHuman = items.map((r: any) => ({
      ...r,
      human: humanizeAuditRow(r, 'Asia/Tehran'),
    }));
    return { items: itemsHuman, total, page, limit };
  }

  /** ثبت لاگ (ممکن است چیزی ذخیره نشود → null) */
  async log(args: AuditLogInput): Promise<AuditLog | null> {
    if (!this.shouldPersist(args)) {
      return null;
    }

    const actorId = args.actor_id ?? args.actor?.id ?? null;
    const targetId = args.target_user_id ?? args.target_user?.id ?? null;

    const row: DeepPartial<AuditLog> = {
      topic: args.topic,
      event: args.event ?? null,

      // FK + relation
      actor_id: actorId,
      target_user_id: targetId,
      actor: actorId ? ({ id: actorId } as any) : null,
      target_user: targetId ? ({ id: targetId } as any) : null,

      // snapshots
      actor_name_snapshot: args.actor?.name ?? null,
      actor_role_level_snapshot: args.actor?.role_level ?? null,
      target_name_snapshot: args.target_user?.name ?? null,
      target_role_level_snapshot: args.target_user?.role_level ?? null,

      // non-user entity
      entity_type: args.entity_type ?? args.entity?.type ?? null,
      entity_id: args.entity_id ?? args.entity?.id ?? null,
      entity_label_snapshot: args.entity_label_snapshot ?? args.entity?.label ?? null,

      message: args.message ?? null,
      metadata: args.metadata ?? null,
      ip: args.ip ?? null,
      user_agent: args.user_agent ?? null,
    };

    return this.logRepo.save(this.logRepo.create(row));
  }
}

/** ورودی ثبت لاگ */
export type AuditLogInput = {
  topic: AuditTopic;
  event?: string;

  actor_id?: number | null;
  target_user_id?: number | null;

  actor?: { id?: number | null; name?: string | null; role_level?: number | null };
  target_user?: { id?: number | null; name?: string | null; role_level?: number | null };

  entity?: { type?: string | null; id?: number | null; label?: string | null };

  entity_type?: string | null;
  entity_id?: number | null;
  entity_label_snapshot?: string | null;

  message?: string | null;
  metadata?: any;
  ip?: string | null;
  user_agent?: string | null;
};
function normalizeTopics(t?: string[] | string): string[] {
  if (Array.isArray(t)) return t.filter(Boolean);
  if (typeof t === 'string') return t.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}
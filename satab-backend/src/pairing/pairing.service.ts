// pairing.service.ts
import {
  Injectable, Logger,
  NotFoundException, GoneException, ConflictException,
  RequestTimeoutException, BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial } from 'typeorm';
import { generatePin4 } from '../vehicles/utils/generate-pin';
import { Vehicle, VehicleStatus } from '../vehicles/vehicle.entity';
import { Users } from '../users/users.entity';
import { Observable, Subject } from 'rxjs';
import { UserLevel } from 'src/entities/role.entity';

type CodeRecord = {
  userId: number;
  expiresAt: number;         // ms epoch
  used: boolean;
  timer: NodeJS.Timeout | null;
};

type Waiter = {
  resolve: (v: any) => void;
  reject: (e: any) => void;
  timeout: NodeJS.Timeout;
};

const TTL_MS = 60_000;           // 60s
const USED_TTL_MS = 10 * 60_000; // 10m
type RoleLevel = 3 | 4 | 5 | 6;

type CreateUserProfile = {
  full_name: string;
  phone: string;
  password: string;   // در محصول واقعی: هش شود
  role_level: RoleLevel;
  parent_id: number;
};

type PendingStatus = 'waiting' | 'mismatch' | 'failed' | 'matched';

type PendingSession = {
  id: string;                     // pending_id
  expected_uid_hex: string;       // HEX16 UPPERCASE
  profile: CreateUserProfile;     // داده‌های ساخت کاربر
  status: PendingStatus;
  created_at: number;             // ms epoch
  expires_in: number;             // seconds
  user_id?: number;
  full_name?: string;
  message?: string;               // برای failed/mismatch
  timer?: NodeJS.Timeout | null;
};

function genPendingId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}
function normalize8ByteCode(input: string): { ok: boolean; hex16?: string; msg?: string } {
  const v = String(input || '').trim();
  if (!v) return { ok: false, msg: 'empty' };
  const isHex = /^[0-9a-fA-F]{16}$/.test(v);
  const isDec = /^[0-9]{1,20}$/.test(v);
  if (!isHex && !isDec) return { ok: false, msg: 'bad format' };
  if (isHex) return { ok: true, hex16: v.toUpperCase() };
  try {
    const n = BigInt(v);
    if (n < 0n || n > 0xFFFFFFFFFFFFFFFFn) return { ok: false, msg: 'out of 64-bit' };
    return { ok: true, hex16: n.toString(16).padStart(16, '0').toUpperCase() };
  } catch {
    return { ok: false, msg: 'invalid number' };
  }
}

// -----------------------------
// تنظیمات Pairing Code (قدیمی)
// -----------------------------


@Injectable()
export class PairingService {
  private readonly log = new Logger(PairingService.name);
  constructor(@InjectDataSource() private readonly ds: DataSource) { }

  private codes = new Map<string, CodeRecord>();
  private used = new Map<string, number>();
  private waiters = new Map<string, Waiter[]>();
  private results = new Map<string, any>();
  private resultTimers = new Map<string, NodeJS.Timeout>();



  private pendings = new Map<string, PendingSession>();
  private streams = new Map<string, Subject<MessageEvent>>();







  private now() { return Date.now(); }
  private cleanupUsed() {
    const t = this.now();
    for (const [code, exp] of this.used) if (exp <= t) this.used.delete(code);
  }
  private timeLeft(expiresAt: number) {
    return Math.max(0, expiresAt - this.now());
  }

  private buildPlaceholderPlate(deviceUid: string) {
    return `PAIR-${deviceUid.slice(-8)}`;
  }
  private defaultVehicleType(): Vehicle['vehicle_type_code'] {
    return 'sedan';
  }

  async issue(userId: number) {
    this.cleanupUsed();
    const expiresAt = this.now() + TTL_MS;

    for (let i = 0; i < 6; i++) {
      const code = generatePin4();
      const usedExp = this.used.get(code);
      if (this.codes.has(code)) continue;
      if (usedExp && usedExp > this.now()) continue;

      const rec: CodeRecord = { userId, expiresAt, used: false, timer: null };
      rec.timer = setTimeout(() => {
        this.codes.delete(code);
        const arr = this.waiters.get(code);
        if (arr?.length) {
          for (const w of arr) { clearTimeout(w.timeout); w.reject(new RequestTimeoutException('timeout')); }
          this.waiters.delete(code);
        }
      }, TTL_MS);

      this.codes.set(code, rec);
      return { code, expires_at: new Date(expiresAt).toISOString() };
    }
    throw new ConflictException('busy, try again');
  }


  // برد فقط vehicle_id می‌خواهد
  async redeem(code: string, deviceId: string) {
    const t0 = Date.now();
    const mask = (s: string, keep = 4) => (s ? `${s.slice(0, keep)}…${s.slice(-keep)}` : '');
    const logCtx = (extra = '') =>
      `redeem code=${code} dev=${mask(String(deviceId || ''))} ${extra ? '| ' + extra : ''}`;

    this.log.debug(logCtx('start'));

    try {
      const rec = this.codes.get(code);
      const usedExp = this.used.get(code);

      // --- guardrails
      if (usedExp && usedExp > this.now()) {
        this.log.warn(logCtx('fail: code already used (cache)'));
        throw new GoneException('code used');
      }
      if (!rec) {
        this.log.warn(logCtx('fail: code not found/expired (memory)'));
        throw new NotFoundException('code not found/expired');
      }
      if (rec.used) {
        this.log.warn(logCtx(`fail: code already used (record)`));
        throw new GoneException('code used');
      }
      if (this.now() > rec.expiresAt) {
        if (rec.timer) clearTimeout(rec.timer);
        this.codes.delete(code);
        this.log.warn(logCtx('fail: code expired (deadline)'));
        throw new GoneException('expired');
      }

      const normUid = String(deviceId || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
      if (!/^[0-9A-F]{24}$/.test(normUid)) {
        this.log.warn(logCtx('fail: bad device_id format'));
        throw new BadRequestException('device_id must be 24 hex');
      }

      this.log.debug(logCtx(`validated | user=${rec.userId} | uid=${mask(normUid, 6)}`));

      // --- DB section
      const vehicle_id: number = await this.ds.transaction(async (q) => {
        const vehRepo = q.getRepository(Vehicle);
        const userRepo = q.getRepository(Users);

        const owner = await userRepo.findOne({ where: { id: rec.userId } });
        if (!owner) {
          this.log.warn(logCtx(`fail: owner not found user=${rec.userId}`));
          throw new NotFoundException('owner not found');
        }

        // فقط id لازم داریم
        let veh: Pick<Vehicle, 'id'> | null = null;

        // 1) آیا قبلاً برای همین مالک ثبت شده؟
        const foundSameOwner = await vehRepo.findOne({
          where: { device_uid: normUid, owner_user: { id: rec.userId } },
          select: ['id'], // فقط ستون‌های Vehicle
        });

        if (foundSameOwner) {
          veh = { id: foundSameOwner.id };
        } else {
          // 2) آیا این uid برای کاربر دیگری است؟
          const existingByUid = await vehRepo.findOne({
            where: { device_uid: normUid },
            select: ['id'],              // فقط ستون‌های Vehicle
            relations: { owner_user: true }, // یا rely کنی به eager (داری)، اما explicit بهتره
          });

          if (existingByUid) {
            const ownerIdOfFound = existingByUid.owner_user?.id; // relation
            if (ownerIdOfFound !== rec.userId) {
              this.log.warn(logCtx(
                `fail: device_uid bound to another user | uid=${mask(normUid, 6)} -> owner=${ownerIdOfFound}`
              ));
              throw new ConflictException('device already paired to another user');
            } else {
              veh = { id: existingByUid.id }; // همان مالک → reuse
            }
          }

        }

        // 3) اگر هنوز veh نداریم، بسازیم
        // اگر هنوز veh نداریم، بسازیم
        if (!veh) {
          const placeholderPlate = this.buildPlaceholderPlate(normUid);
          const toCreate = vehRepo.create({
            owner_user: { id: rec.userId } as Users, // ← مالک همان کاربر لاگین‌شده/درحال‌اضافه‌کردن
            name: `Device-${normUid.slice(-6)}`,
            country_code: 'IR',
            vehicle_type_code: this.defaultVehicleType(),
            plate_no: placeholderPlate,
            status: VehicleStatus.active,
            device_uid: normUid,
          });

          try {
            const saved = await vehRepo.save(toCreate);
            veh = { id: saved.id };
          } catch (e: any) {
            const msg = String(e?.message || '');
            const code = String(e?.code || '').toUpperCase();
            const isDup = code === '23505' || msg.includes('duplicate') || msg.includes('ER_DUP_ENTRY') || msg.includes('UNIQUE');
            if (isDup) {
              const retry = vehRepo.create({
                ...toCreate,
                plate_no: `${placeholderPlate}${Date.now().toString(36).slice(-3)}`.slice(0, 32),
              });
              const saved2 = await vehRepo.save(retry);
              veh = { id: saved2.id };
            } else {
              throw e;
            }
          }
        }


        // گارد نهایی: از اینجا به بعد veh هرگز null نیست
        if (!veh?.id) {
          this.log.error(logCtx('fail: vehicle create/find produced no id'));
          throw new ConflictException('vehicle create/find failed');
        }

        return Number(veh.id);
      });


      // --- finalize
      rec.used = true;
      this.results.set(code, { vehicle_id });
      this.used.set(code, this.now() + USED_TTL_MS);
      if (rec.timer) clearTimeout(rec.timer);
      this.codes.delete(code);

      const arr = this.waiters.get(code);
      if (arr?.length) {
        for (const w of arr) { clearTimeout(w.timeout); w.resolve({ vehicle_id }); }
        this.waiters.delete(code);
      }

      const prevTimer = this.resultTimers.get(code);
      if (prevTimer) clearTimeout(prevTimer);
      this.resultTimers.set(code, setTimeout(() => {
        this.results.delete(code);
        this.resultTimers.delete(code);
      }, USED_TTL_MS));

      this.log.debug(logCtx(`success vehicle_id=${vehicle_id} | dur=${Date.now() - t0}ms`));
      return { vehicle_id };
    } catch (err) {
      // NestJS خودش استاتوس‌های HttpException رو درست برمی‌گردونه؛
      // ما فقط لاگ کامل می‌گیریم.
      const isHttp = typeof err?.getStatus === 'function';
      const status = isHttp ? err.getStatus() : 500;
      this.log.error(logCtx(`error status=${status} | dur=${Date.now() - t0}ms | msg=${err?.message || err}`));
      throw err;
    }
  }


  async wait(code: string) {
    const ready = this.results.get(code);
    if (ready) return ready;

    const rec = this.codes.get(code);
    if (!rec) throw new NotFoundException('code not found/expired');

    const left = this.timeLeft(rec.expiresAt);
    if (left <= 0) {
      this.codes.delete(code);
      if (rec.timer) clearTimeout(rec.timer);
      throw new RequestTimeoutException('timeout');
    }

    return await new Promise((resolve, reject) => {
      let waiter!: Waiter;
      const timeout = setTimeout(() => {
        const arr = this.waiters.get(code) || [];
        this.waiters.set(code, arr.filter((w) => w !== waiter));
        reject(new RequestTimeoutException('timeout'));
      }, Math.min(left, TTL_MS));
      waiter = { resolve, reject, timeout };
      const arr = this.waiters.get(code) || [];
      arr.push(waiter);
      this.waiters.set(code, arr);
    });
  }


















  issuePending(expected_uid_hex: string, profile: CreateUserProfile, expires_in = 60) {
    const norm = normalize4ByteCode(expected_uid_hex);
    if (!norm.ok) throw new BadRequestException(norm.msg || 'invalid expected_uid_hex');

    const id = genPendingId();
    const ttl = Math.max(10, Math.min(Number(expires_in) || 60, 600));

    const sess: PendingSession = {
      id,
      expected_uid_hex: norm.hex8,   // ← 8 رقمی
      profile,
      status: 'waiting',
      created_at: Date.now(),
      expires_in: ttl,
      timer: null,
    };

    sess.timer = setTimeout(() => {
      const s = this.pendings.get(id);
      if (s && s.status === 'waiting') {
        s.status = 'failed';
        s.message = 'timeout';
        this.emitPending(id, 'failed', { message: 'timeout' });
      }
    }, ttl * 1000);

    this.pendings.set(id, sess);
    if (!this.streams.has(id)) this.streams.set(id, new Subject<MessageEvent>());
    return { pending_id: id, expires_in: ttl };
  }


  /** وضعیت برای Polling */
  getStatus(id: string) {
    const s = this.pendings.get(id);
    if (!s) return { status: 'failed' as PendingStatus, message: 'not found' };
    return { status: s.status, user_id: s.user_id, full_name: s.full_name, message: s.message };
  }

  /** SSE stream مطابق NestJS */
  sse(id: string): Observable<MessageEvent> {
    let subj = this.streams.get(id);
    if (!subj) {
      subj = new Subject<MessageEvent>();
      this.streams.set(id, subj);
    }
    // اگر تعیین تکلیف شده، همان لحظه event بده
    const cur = this.pendings.get(id);
    if (cur) {
      if (cur.status === 'matched') this.emitPending(id, 'matched', { user_id: cur.user_id, full_name: cur.full_name });
      else if (cur.status === 'mismatch') this.emitPending(id, 'mismatch', { message: cur.message || 'mismatch' });
      else if (cur.status === 'failed') this.emitPending(id, 'failed', { message: cur.message || 'failed' });
    }
    return subj.asObservable();
  }

  /** برد UID را ارسال می‌کند؛ در صورت match → ساخت کاربر + matched */
  async submitUid(id: string, rawUid: string) {
    const s = this.pendings.get(id);
    if (!s) throw new NotFoundException('pending not found');
    if (s.status !== 'waiting') {
      return { user_id: s.user_id, full_name: s.full_name, message: s.message };
    }

    const age = (Date.now() - s.created_at) / 1000;
    if (age > s.expires_in) {
      s.status = 'failed'; s.message = 'timeout';
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      this.emitPending(id, 'failed', { message: 'timeout' });
      throw new RequestTimeoutException('timeout');
    }

    const norm = normalize4ByteCode(rawUid);
    if (!norm.ok) {
      s.status = 'failed'; s.message = 'bad uid';
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      this.emitPending(id, 'failed', { message: 'bad uid' });
      throw new BadRequestException('bad uid');
    }

    if (norm.hex8 !== s.expected_uid_hex) {
      s.status = 'mismatch'; s.message = 'UID mismatch';
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      this.emitPending(id, 'mismatch', { message: 'UID mismatch' });
      throw new ConflictException('UID mismatch');
    }

    const created = await this.createUserDriver(s.profile);
    s.status = 'matched';
    s.user_id = created.id;
    s.full_name = created.full_name;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    this.emitPending(id, 'matched', { user_id: created.id, full_name: created.full_name });
    return { user_id: created.id, full_name: created.full_name };
  }


  // ارسال event به استریم SSE
  private emitPending(id: string, type: 'matched' | 'mismatch' | 'failed', data: any) {
    const subj = this.streams.get(id);
    if (subj && !subj.closed) {
      subj.next({ type, data } as any);
    }
  }
  // داخل کلاس PairingService
  async submitUidByUidOnly(rawUid: string) {
    const t0 = Date.now();
    const mask = (s: string, keep = 4) => (s ? `${s.slice(0, keep)}…${s.slice(-keep)}` : '');
    const logCtx = (extra = '') =>
      `submitUidByUidOnly uid=${mask(String(rawUid || ''), 6)}${extra ? ' | ' + extra : ''}`;

    try {
      this.log.debug(logCtx('start'));
      this.log.debug(logCtx(`mapsize pendings=${this.pendings.size} streams=${this.streams.size}`));

      // 1) Normalize UID (8-hex / last-8 of 16-hex / decimal up to 32-bit)
      const norm = normalize4ByteCode(rawUid); // ← باید قبلاً تعریف شده باشه
      if (!norm.ok) {
        this.log.warn(logCtx(`fail: bad uid format | reason=${norm.msg || 'invalid'}`));
        throw new BadRequestException('bad uid');
      }
      const hex = norm.hex8.toUpperCase();
      this.log.debug(logCtx(`normalized hex=${hex}`));

      // 2) Find latest waiting session with this expected_uid_hex
      let candidate: PendingSession | undefined;
      let scanned = 0;
      for (const s of this.pendings.values()) {
        scanned++;
        if (s.status === 'waiting' && s.expected_uid_hex === hex) {
          if (!candidate || s.created_at > candidate.created_at) candidate = s;
        }
      }
      this.log.debug(logCtx(`scan done scanned=${scanned} found=${candidate ? 'yes' : 'no'}`));

      if (!candidate) {
        this.log.warn(logCtx('fail: no pending session for this uid'));
        throw new NotFoundException('no pending session for this uid');
      }

      this.log.debug(
        logCtx(
          `candidate id=${candidate.id} status=${candidate.status} created_at=${new Date(
            candidate.created_at,
          ).toISOString()} ttl=${candidate.expires_in}s`,
        ),
      );

      // 3) Check expiration
      const ageSec = (Date.now() - candidate.created_at) / 1000;
      if (ageSec > candidate.expires_in) {
        this.log.warn(
          logCtx(`timeout: ageSec=${Math.floor(ageSec)} > expires_in=${candidate.expires_in}`),
        );
        candidate.status = 'failed';
        candidate.message = 'timeout';
        if (candidate.timer) {
          clearTimeout(candidate.timer);
          candidate.timer = null;
        }
        this.emitPending(candidate.id, 'failed', { message: 'timeout' });
        throw new RequestTimeoutException('timeout');
      }

      // 4) MATCH → create user/driver
      this.log.debug(
        logCtx(
          `match accepted → creating user full_name="${candidate.profile.full_name}" phone="${candidate.profile.phone}"`,
        ),
      );
      const created = await this.createUserDriver(candidate.profile);

      candidate.status = 'matched';
      candidate.user_id = created.id;
      candidate.full_name = created.full_name;
      if (candidate.timer) {
        clearTimeout(candidate.timer);
        candidate.timer = null;
      }

      // 5) Notify front via SSE
      this.log.debug(
        logCtx(
          `emit matched pending_id=${candidate.id} user_id=${created.id} full_name="${created.full_name}"`,
        ),
      );
      this.emitPending(candidate.id, 'matched', {
        user_id: created.id,
        full_name: created.full_name,
      });

      const dur = Date.now() - t0;
      this.log.debug(logCtx(`success dur=${dur}ms`));

      // 6) Response for board (بدون status)
      return { user_id: created.id, full_name: created.full_name };
    } catch (err) {
      const isHttp = typeof (err as any)?.getStatus === 'function';
      const status = isHttp ? (err as any).getStatus() : 500;
      const dur = Date.now() - t0;
      this.log.error(logCtx(`error status=${status} dur=${dur}ms | msg=${(err as any)?.message || err}`));
      throw err;
    }
  }


  // ساخت راننده در DB (حداقلی؛ بسته به اسکیمای Users)
  // داخل کلاس PairingService

  /**
   * ساخت راننده/کاربر با اسکیمای فعلی Users
   * - فیلدها: full_name, phone, password, role_level, parent (relation), driver_card_hex(optional)
   * - اگر phone تکراری باشد: همان کاربر را برمی‌گرداند (می‌تونی به Conflict تغییرش بدی)
   */
  private async createUserDriver(
    p: CreateUserProfile & { driver_card_hex?: string | null }
  ): Promise<{ id: number; full_name: string }> {
    return this.ds.transaction(async (q) => {
      const usersRepo = q.getRepository(Users);

      // صراحتاً Users | null تا TS آرایه برداشت نکند
      const exist: Users | null = await usersRepo.findOne({
        where: { phone: p.phone },
        select: { id: true, full_name: true } as any,
      });

      if (exist) {
        // اگر سیاستت conflict است، این را باز کن:
        // throw new ConflictException('phone already exists');
        return { id: Number(exist.id), full_name: exist.full_name };
      }

      // نقش را مطابق enum خودت Cast می‌کنیم
      const roleLevel = p.role_level as unknown as UserLevel;

      // DeepPartial<Users> (تک شیء) — نه آرایه
      const partial: DeepPartial<Users> = {
        full_name: p.full_name,
        phone: p.phone,
        password: p.password,            // TODO: در محصول واقعی: bcrypt.hash
        role_level: roleLevel,
        // رابطه‌ی والد طبق Entity شما با فیلد parent و ستون parent_id
        parent: p.parent_id ? ({ id: p.parent_id } as any) : null,
        // اگر خواستی HEX کارت راننده را نگه داری:
        driver_card_hex: p.driver_card_hex ?? null,
        // اگر می‌خواهی sa_type را اینجا هم ست کنی، خودش را اضافه کن:
        // sa_type: null as SuperAdminType | null,
      };

      const entity = usersRepo.create(partial);  // ← Users
      const saved = await usersRepo.save(entity); // ← Users

      return { id: Number(saved.id), full_name: saved.full_name };
    });
  }

}
// بالا کنار normalize8ByteCode فعلی (یا جایگزینش کن)
function normalize4ByteCode(input: string): { ok: true; hex8: string } | { ok: false; msg: string } {
  const v = String(input || '').trim();
  if (!v) return { ok: false, msg: 'empty' };

  const isHex8 = /^[0-9a-fA-F]{8}$/.test(v);
  const isHex16 = /^[0-9a-fA-F]{16}$/.test(v); // اگر دستگاه 16 رقم می‌فرستد، 8 رقم انتهایی را می‌گیریم
  const isDec = /^[0-9]{1,10}$/.test(v);     // تا حداکثر 32-bit

  if (isHex8) return { ok: true, hex8: v.toUpperCase() };
  if (isHex16) return { ok: true, hex8: v.toUpperCase().slice(-8) };

  if (isDec) {
    try {
      const n = BigInt(v);
      if (n < 0n || n > 0xFFFFFFFFn) return { ok: false, msg: 'out of 32-bit' };
      return { ok: true, hex8: n.toString(16).padStart(8, '0').toUpperCase() };
    } catch {
      return { ok: false, msg: 'invalid number' };
    }
  }

  return { ok: false, msg: 'bad format' };
}

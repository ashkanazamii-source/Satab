// pairing.service.ts
import {
  Injectable, Logger,
  NotFoundException, GoneException, ConflictException,
  RequestTimeoutException, BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { generatePin4 } from '../vehicles/utils/generate-pin';
import { Vehicle, VehicleStatus } from '../vehicles/vehicle.entity';
import { Users } from '../users/users.entity';

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

@Injectable()
export class PairingService {
  private readonly log = new Logger(PairingService.name);
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private codes = new Map<string, CodeRecord>();
  private used = new Map<string, number>();
  private waiters = new Map<string, Waiter[]>();
  private results = new Map<string, any>();
  private resultTimers = new Map<string, NodeJS.Timeout>();

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
  async redeem(code: string, deviceId: string, deviceName?: string) {
    const rec = this.codes.get(code);
    const usedExp = this.used.get(code);

    if (usedExp && usedExp > this.now()) throw new GoneException('code used');
    if (!rec) throw new NotFoundException('code not found/expired');
    if (rec.used) throw new GoneException('code used');
    if (this.now() > rec.expiresAt) {
      this.codes.delete(code);
      if (rec.timer) clearTimeout(rec.timer);
      throw new GoneException('expired');
    }

    const normUid = String(deviceId || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (!/^[0-9A-F]{24}$/.test(normUid)) {
      throw new BadRequestException('device_id must be 24 hex');
    }

    const vehicle_id: number = await this.ds.transaction(async (q) => {
      const vehRepo = q.getRepository(Vehicle);
      const userRepo = q.getRepository(Users);

      const owner = await userRepo.findOne({ where: { id: rec.userId } });
      if (!owner) throw new NotFoundException('owner not found');

      let veh = await vehRepo.findOne({
        where: { device_uid: normUid, owner_user_id: rec.userId },
        select: ['id'],
      });

      if (!veh) {
        const placeholderPlate = this.buildPlaceholderPlate(normUid);
        const toCreate = vehRepo.create({
          owner_user: owner,
          name: deviceName?.trim() || `Device-${normUid.slice(-6)}`,
          country_code: 'IR',
          vehicle_type_code: this.defaultVehicleType(),
          plate_no: placeholderPlate,
          status: VehicleStatus.active,
          device_uid: normUid,
        });

        try {
          veh = await vehRepo.save(toCreate);
        } catch (e: any) {
          if (String(e?.message || '').includes('duplicate key')) {
            const retry = vehRepo.create({
              ...toCreate,
              plate_no: `${placeholderPlate}${Date.now().toString(36).slice(-3)}`.slice(0, 32),
            });
            veh = await vehRepo.save(retry);
          } else {
            throw e;
          }
        }
      }

      if (!veh?.id) throw new ConflictException('vehicle create/find failed');
      return Number(veh.id);
    });

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

    // ⬅️ فقط vehicle_id برمی‌گردد
    return { vehicle_id };
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
}

import {
    Injectable,
    NotFoundException,
    GoneException,
    ConflictException,
    RequestTimeoutException,
    BadRequestException,
} from '@nestjs/common';
import { generatePin4 } from '../vehicles/utils/generate-pin';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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

const TTL_MS = 60_000;           // اعتبار کد: ۶۰ ثانیه
const USED_TTL_MS = 10 * 60_000; // ردپا برای جلوگیری از reuse: ۱۰ دقیقه

@Injectable()
export class PairingService {
    constructor(@InjectDataSource() private readonly ds: DataSource) { }

    // کدهای فعال
    private codes = new Map<string, CodeRecord>();
    // کدهای اخیراً مصرف‌شده (برای جلوگیری از برخورد)
    private used = new Map<string, number>(); // code -> expireAt
    // منتظرها (فرانت‌هایی که wait زده‌اند)
    private waiters = new Map<string, Waiter[]>();
    // نتیجهٔ آماده (اگر برد زودتر از فرانت رسید)
    private results = new Map<string, any>(); // code -> payload
    // تایمر پاک‌سازی نتیجه
    private resultTimers = new Map<string, NodeJS.Timeout>();

    private now() { return Date.now(); }

    private cleanupUsed() {
        const t = this.now();
        for (const [code, exp] of this.used) if (exp <= t) this.used.delete(code);
    }

    private timeLeft(expiresAt: number) {
        return Math.max(0, expiresAt - this.now());
    }

    async issue(userId: number) {
        this.cleanupUsed();
        const expiresAt = this.now() + TTL_MS;

        for (let i = 0; i < 6; i++) {
            const code = generatePin4(); // "0000".."9999"
            const usedExp = this.used.get(code);
            if (this.codes.has(code)) continue;
            if (usedExp && usedExp > this.now()) continue;

            const rec: CodeRecord = { userId, expiresAt, used: false, timer: null };

            // تایمر انقضا
            rec.timer = setTimeout(() => {
                this.codes.delete(code);
                // همهٔ waiterها رو با timeout بنداز بیرون
                const arr = this.waiters.get(code);
                if (arr && arr.length) {
                    for (const w of arr) {
                        clearTimeout(w.timeout);
                        w.reject(new RequestTimeoutException('هیچ پیامی از برد دریافت نشد (timeout).'));
                    }
                    this.waiters.delete(code);
                }
            }, TTL_MS);

            this.codes.set(code, rec);
            return { code, expires_at: new Date(expiresAt).toISOString() };
        }
        throw new ConflictException('سامانه مشغوله، دوباره تلاش کن.');
    }

    // برد اینو صدا می‌زنه
    async redeem(code: string, deviceId: string, deviceName?: string) {
        const rec = this.codes.get(code);
        const usedExp = this.used.get(code);

        if (usedExp && usedExp > this.now()) {
            throw new GoneException('کد مصرف شده است.');
        }
        if (!rec) {
            throw new NotFoundException('کد پیدا نشد یا منقضی شده است.');
        }
        if (rec.used) {
            throw new GoneException('کد مصرف شده است.');
        }
        if (this.now() > rec.expiresAt) {
            this.codes.delete(code);
            if (rec.timer) clearTimeout(rec.timer);
            throw new GoneException('کد منقضی شده است.');
        }

        // ✅ ولیدیشن و نرمال‌سازی شناسه ۹۶‌بیتی (۲۴ کاراکتر HEX)
        const normId = String(deviceId || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (normId.length !== 24) {
            throw new BadRequestException('device_id باید ۲۴ کاراکتر هگز (شناسه ۹۶ بیتی) باشد.');
        }

        // ✅ UPSERT دستگاه برای صاحب کد
        await this.ds.query(
            `INSERT INTO devices (device_id, owner_user_id, name, created_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (device_id) DO UPDATE
       SET owner_user_id = EXCLUDED.owner_user_id,
           name = COALESCE(NULLIF(EXCLUDED.name, ''), devices.name)`,
            [normId, rec.userId, deviceName ?? null],
        );

        rec.used = true;

        // خروجی مشترک برای فرانت/انتظارها
        const payload = {
            paired: true,
            owner_user_id: rec.userId,
            device_id: normId,
            device_name: deviceName,
        };

        // نتیجه را نگه دار (اگر wait بعداً بیاید)
        this.results.set(code, payload);
        // ردپا برای جلوگیری از reuse
        this.used.set(code, this.now() + USED_TTL_MS);

        // پاکسازی رکورد کد و تایمرش
        if (rec.timer) clearTimeout(rec.timer);
        this.codes.delete(code);

        // resolve کردن همه‌ی waiterها
        const arr = this.waiters.get(code);
        if (arr && arr.length) {
            for (const w of arr) {
                clearTimeout(w.timeout);
                w.resolve(payload);
            }
            this.waiters.delete(code);
        }

        // نتیجه بعد از ۱۰ دقیقه پاک شود
        const prevTimer = this.resultTimers.get(code);
        if (prevTimer) clearTimeout(prevTimer);
        this.resultTimers.set(
            code,
            setTimeout(() => {
                this.results.delete(code);
                this.resultTimers.delete(code);
            }, USED_TTL_MS),
        );

        return payload;
    }

    // فرانت/پنل با این منتظر می‌مونه تا برد بیاد
    async wait(code: string) {
        // اگر قبلاً redeem شده
        const ready = this.results.get(code);
        if (ready) return ready;

        const rec = this.codes.get(code);
        if (!rec) {
            throw new NotFoundException('کد پیدا نشد یا منقضی شده است.');
        }

        const left = this.timeLeft(rec.expiresAt);
        if (left <= 0) {
            this.codes.delete(code);
            if (rec.timer) clearTimeout(rec.timer);
            throw new RequestTimeoutException('هیچ پیامی از برد دریافت نشد (timeout).');
        }

        // long-poll Promise — ساخت waiter قبل از setTimeout و نگهداری هندل
        return await new Promise((resolve, reject) => {
            let waiter!: Waiter;
            const timeout = setTimeout(() => {
                const arr = this.waiters.get(code) || [];
                this.waiters.set(
                    code,
                    arr.filter((w) => w !== waiter),
                );
                reject(new RequestTimeoutException('هیچ پیامی از برد دریافت نشد (timeout).'));
            }, Math.min(left, TTL_MS));

            waiter = { resolve, reject, timeout };
            const arr = this.waiters.get(code) || [];
            arr.push(waiter);
            this.waiters.set(code, arr);
        });
    }
}

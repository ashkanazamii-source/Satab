// src/sms/otp.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

type Purpose = 'signup' | 'driver' | 'login' | string;

type OtpRecord = {
  code: string;
  expireAt: number;   // ms epoch
  attempts: number;
  lastSendAt: number; // محدودیت ارسال مجدد
  verified?: boolean;
};

@Injectable()
export class OtpService {
  private store = new Map<string, OtpRecord>();

  // ✳️ تنظیمات (قابل override با ENV)
  private CODE_TTL_MS = Number(process.env.OTP_TTL_MS ?? 2 * 60 * 1000);         // اعتبار پیش‌فرض ۲ دقیقه
  private RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS ?? 60 * 1000); // فاصله ارسال مجدد ۶۰ ثانیه
  private MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);              // حداکثر دفعات تلاش برای Verify
  private DEFAULT_LEN = Number(process.env.OTP_DEFAULT_CODE_LEN ?? 6);           // طول کد پیش‌فرض
  private DRIVER_LEN = Number(process.env.OTP_DRIVER_CODE_LEN ?? 8);             // طول کد برای راننده

  constructor(private sms: SmsProvider) {}

  // کلید ذخیره
  private key(phone: string, purpose: Purpose) {
    return `${purpose}:${phone}`;
  }

  // نرمال‌سازی شماره (مثلاً 09… → 989…)
  private normalizePhone(raw: string) {
    const v = (raw || '').trim().replace(/\s+/g, '');
    if (!v) return v;
    if (v.startsWith('+')) return v.slice(1);
    if (v.startsWith('00')) return v.slice(2);
    if (v.startsWith('0') && v.length === 11) return `98${v.slice(1)}`;
    return v;
  }

  // ساخت کد
  private genCode(len: number) {
    const start = 10 ** (len - 1);
    const range = 9 * start;
    return Math.floor(start + Math.random() * range).toString();
  }

  // متن پیام بر اساس purpose
  private smsText(purpose: Purpose, code: string) {
    const map: Record<string, string> = {
      signup: `کد تایید ثبت‌نام: ${code}`,
      login: `کد ورود: ${code}`,
      driver: `کد تایید راننده: ${code}`,
    };
    return map[purpose] || `کد تایید: ${code}`;
  }

  async send(phoneRaw: string, purpose: Purpose = 'signup') {
    const phone = this.normalizePhone(phoneRaw);
    if (!phone) throw new BadRequestException('phone is required');

    const k = this.key(phone, purpose);
    const now = Date.now();

    // کول‌داون ارسال مجدد
    const prev = this.store.get(k);
    if (prev && now - prev.lastSendAt < this.RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((this.RESEND_COOLDOWN_MS - (now - prev.lastSendAt)) / 1000);
      throw new BadRequestException(`لطفاً ${wait} ثانیه دیگر دوباره تلاش کنید`);
    }

    // ✅ طول کد: راننده ۸ رقمی، سایرین ۶ رقمی (قابل تنظیم با ENV)
    const len = (purpose === 'driver') ? this.DRIVER_LEN : this.DEFAULT_LEN;
    const code = this.genCode(len);

    const rec: OtpRecord = {
      code,
      expireAt: now + this.CODE_TTL_MS,
      attempts: 0,
      lastSendAt: now,
    };
    this.store.set(k, rec);

    // ارسال پیامک
    const text = this.smsText(purpose, code);
    await this.sms.send(phone, text);

    // پاکسازی رکوردهای خیلی قدیمی
    this.gc();

    // در غیرپروداکشن (یا با OTP_ECHO=true) کد را هم برگردانیم برای QA
    const payload: any = {
      ok: true,
      ttl_ms: this.CODE_TTL_MS,
      resend_cooldown_ms: this.RESEND_COOLDOWN_MS,
      purpose,
      normalized_phone: phone,
    };
    if (process.env.NODE_ENV !== 'production' || process.env.OTP_ECHO === 'true') {
      payload.code = code;
    }
    return payload;
  }

  async verify(phoneRaw: string, code: string, purpose: Purpose = 'signup') {
    const phone = this.normalizePhone(phoneRaw);
    if (!phone || !code) throw new BadRequestException('phone and code are required');

    const k = this.key(phone, purpose);
    const rec = this.store.get(k);
    const now = Date.now();

    if (!rec) throw new BadRequestException('کدی برای این شماره یافت نشد');
    if (rec.expireAt < now) {
      this.store.delete(k);
      throw new BadRequestException('کد منقضی شده است');
    }
    if (rec.attempts >= this.MAX_ATTEMPTS) {
      this.store.delete(k);
      throw new BadRequestException('تعداد تلاش زیاد بود؛ دوباره ارسال کنید');
    }

    rec.attempts += 1;

    if (rec.code !== code) {
      this.store.set(k, rec); // ذخیره شمارنده تلاش
      throw new BadRequestException('کد نادرست است');
    }

    rec.verified = true;
    this.store.set(k, rec);

    // یک‌بار مصرف: بعد از موفقیت پاک می‌کنیم
    this.store.delete(k);

    return { ok: true };
  }

  // فقط برای QA/دیباگ (کنترل دسترسی در Controller انجام بده)
  peek(phoneRaw: string, purpose: Purpose = 'signup') {
    const phone = this.normalizePhone(phoneRaw);
    const k = this.key(phone, purpose);
    const rec = this.store.get(k);
    if (!rec) return { exists: false };
    return {
      exists: true,
      expireAt: rec.expireAt,
      attempts: rec.attempts,
      verified: !!rec.verified,
      code:
        (process.env.NODE_ENV !== 'production' || process.env.OTP_ECHO === 'true')
          ? rec.code
          : '***',
    };
  }

  private gc() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      // اگر ۵ دقیقه بعد از انقضا گذشته، پاک کن
      if (v.expireAt < now - 5 * 60 * 1000) {
        this.store.delete(k);
      }
    }
  }
}

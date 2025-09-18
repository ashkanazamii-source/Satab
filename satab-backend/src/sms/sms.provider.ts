// src/sms/sms.provider.ts
import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { normalizePhoneToIR99 } from './phone.util';

@Injectable()
export class SmsProvider {
  private wsUrl = process.env.SMS_3300_WSDL_URL?.trim() || 'https://sms.3300.ir/almassms.asmx';
  private user  = process.env.SMS_3300_USER!;
  private pass  = process.env.SMS_3300_PASS!;

  /**
   * متد اصلی برای OTP: یک متن به یک گیرنده (ارسال بالکِ یک‌به‌چند)
   * - encoding = 2 (UTF-8)
   * - mClass   = 1 (ذخیره در حافظه گوشی)
   * - UDH      = "" (خالی)
   */
  async send(toRaw: string, text: string): Promise<{ ok: boolean; providerId?: string; resultCode?: number }> {
    const to = normalizePhoneToIR99(toRaw);

    // طبق داک نگین: SendSms2(username, password, messages[], mobiles[], UDH[], encodings[], mClass[], out messageIds[])
    const body = this.buildSendSms2Envelope({
      username: this.user,
      password: this.pass,
      messages: [text],            // یک پیام برای چند گیرنده → length=1
      mobiles: [to],               // N گیرنده → اینجا 1تا
      udh:      [''],              // خالی
      encodings:[2],               // UTF-8
      mclass:   [1],               // ذخیره در حافظه موبایل
    });

    const { data, status } = await axios.post(this.wsUrl, body, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/SendSms2', // طبق WSDL
      },
      timeout: 15000,
    });

    if (status !== 200 || typeof data !== 'string') {
      throw new Error('SMS provider not reachable');
    }

    // پارس پاسخ:
    // موفقیت: SendSms2Result = یک عدد منفی (طبق داک “عدد منفی یعنی متد OK”)
    // خطا:    کد مثبت (مثل 18 = نام کاربر/رمز اشتباه، 14 = اعتبار کافی نیست، ...)
    const resultCode = this.pickNumberTag(data, /<SendSms2Result>(-?\d+)<\/SendSms2Result>/i);
    if (resultCode == null) {
      // برخی پیاده‌سازی‌ها ممکنه بجای 2، SendSmsResult برگردند؛ پس fallback
      const rcAlt = this.pickNumberTag(data, /<SendSmsResult>(-?\d+)<\/SendSmsResult>/i);
      if (rcAlt == null) throw new Error('SMS provider bad response');
      return this.handleProviderResult(rcAlt, data);
    }
    return this.handleProviderResult(resultCode, data);
  }

  // ===== helpers =====

  private buildSendSms2Envelope(args: {
    username: string;
    password: string;
    messages: string[];
    mobiles: string[];
    udh: string[];
    encodings: number[];
    mclass: number[];
  }) {
    const arr = (name: string, items: (string | number)[], tag: 'string'|'int' = 'string') => {
      // طبق WSDL، آرایه‌ها به شکل <name><string>...</string>...</name> یا <int>...</int> هستند
      const t = tag === 'string' ? 'string' : 'int';
      return `<${name}>${items.map(v => `<${t}>${this.escapeXml(String(v))}</${t}>`).join('')}</${name}>`;
    };

    // Envelope SOAP1.1
    return `<?xml version="1.0" encoding="utf-8"?>
      <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                     xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <SendSms2 xmlns="http://tempuri.org/">
            <pUsername>${this.escapeXml(args.username)}</pUsername>
            <pPassword>${this.escapeXml(args.password)}</pPassword>
            ${arr('messages', args.messages, 'string')}
            ${arr('mobiles',  args.mobiles,  'string')}
            ${arr('UDH',      args.udh,      'string')}
            ${arr('encodings',args.encodings,'int')}
            ${arr('mclass',   args.mclass,   'int')}
          </SendSms2>
        </soap:Body>
      </soap:Envelope>`;
  }

  private escapeXml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private pickNumberTag(xml: string, re: RegExp): number | null {
    const m = xml.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  private extractMessageIds(xml: string): string[] {
    // رایج‌ترین حالت: <pMessageIds><long>123</long><long>456</long>...</pMessageIds>
    const ids: string[] = [];
    const part = xml.match(/<pMessageIds>([\s\S]*?)<\/pMessageIds>/i)?.[1];
    if (!part) return ids;
    const re = /<(?:long|int|string)>(\d+)<\/(?:long|int|string)>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) ids.push(m[1]);
    return ids;
  }

  private handleProviderResult(resultCode: number, xml: string) {
    if (resultCode < 0) {
      // موفقیت: آی‌دی پیامک‌ها
      const ids = this.extractMessageIds(xml);
      return { ok: true, providerId: ids[0] || undefined, resultCode };
    }
    // خطاهای مستند:
    // 18: نام کاربری/رمز اشتباه — 14: اعتبار ناکافی — 409: فاصله بین درخواست‌ها کم است — ...
    const err = this.mapError(resultCode);
    throw new Error(err);
  }

  private mapError(code: number): string {
    const map: Record<number, string> = {
      0:   'خطای غیرمنتظره در سرویس',
      14:  'اعتبار کافی نیست',
      18:  'نام کاربری یا کلمه عبور اشتباه است',
      100: 'طول آرایه ENCODING اشتباه است',
      101: 'طول آرایه MESSAGE اشتباه است',
      102: 'طول آرایه MCLASS اشتباه است',
      103: 'طول آرایه MOBILES اشتباه است',
      104: 'طول آرایه UDH اشتباه است',
      409: 'حداقل فاصله زمانی بین درخواست‌ها رعایت نشده (۵ ثانیه)',
    };
    return map[code] || `SMS provider error (code=${code})`;
  }
}

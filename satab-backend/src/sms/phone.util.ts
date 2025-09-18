// src/sms/phone.util.ts
export function normalizePhoneToIR99(msisdn: string): string {
  const v = (msisdn || '').replace(/[^\d]/g, '');
  if (!v) return v;
  if (v.startsWith('09') && v.length === 11) return `98${v.slice(1)}`;
  if (v.startsWith('9') && v.length === 10)   return `98${v}`;
  if (v.startsWith('0098'))                   return v.slice(2); // 0098... -> 98...
  if (v.startsWith('098'))                    return v.slice(1); // 098...  -> 98...
  if (v.startsWith('98'))                     return v;
  // اگر اصلاً ایرانی نبود، همون رو برگردون (سرویس 3300 معمولاً ایرانیه)
  return v;
}

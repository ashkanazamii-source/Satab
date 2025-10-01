// src/services/api.ts
import axios from 'axios';
import qs from 'qs';
import { AxiosHeaders } from 'axios';

// یک شمارنده برای هم‌بندی لاگ‌های هر درخواست/پاسخ
let REQ_ID = 0;
const BASE =
  location.hostname === 'localhost'
    ? 'http://localhost:3000'       // داخل LAN (بدون Hairpin)
    : 'http://94.183.51.28:3000';   // بیرون LAN

const api = axios.create({
  //baseURL: 'http://localhost:3000',
  //baseURL: import.meta.env?.VITE_API_BASE || '/api',
  //headers: { 'Content-Type': 'application/json' },
  //baseURL: 'https://bone-swimming-invited-polyester.trycloudflare.com',
  baseURL: BASE,
  timeout: 15000,

  //baseURL: ' https://b2417dd675446d.lhr.life',
  // مهم: برای فیلتر آرایه‌ها مثل topic[]=... یا topic=...&topic=...
  paramsSerializer: {
    serialize: (params) =>
      qs.stringify(params, { arrayFormat: 'repeat', encodeValuesOnly: true }),
  },
});

// کمک‌تابع: ساخت URL کامل (base + path + query)
function buildFullUrl(config: any, serializedQuery?: string) {
  const base = (config.baseURL || '').replace(/\/+$/, '');
  const path = String(config.url || '').replace(/^\/+/, '');
  const q =
    serializedQuery ||
    (config.params
      ? qs.stringify(config.params, { arrayFormat: 'repeat', encodeValuesOnly: true })
      : '');
  return `${base}/${path}${q ? `?${q}` : ''}`;
}
function maskToken(tok?: string | null) {
  if (!tok) return undefined;
  return tok.length <= 10 ? tok.replace(/.(?=.{0}$)/g, '*') : tok.slice(0, 4) + '...' + tok.slice(-6);
}
function formDataToObject(fd: any) {
  try {
    if (typeof FormData !== 'undefined' && fd instanceof FormData) {
      const o: Record<string, any> = {};
      (fd as FormData).forEach((v, k) => (o[k] = v));
      return o;
    }
  } catch { }
  return fd;
}

// ---- request ----
api.interceptors.request.use(
  (config) => {
    const id = ++REQ_ID;
    (config as any)._reqId = id;
    (config as any)._t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const urlPath = String(config.url || '');

    // ✅ headers را حتماً به AxiosHeaders تبدیل کن
    const h =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers as any);
    config.headers = h; // مهم

    // مسیرهای بدون احراز
    const NO_AUTH = ['/auth/login', '/auth/register', '/auth/refresh'];
    const skipAuth = NO_AUTH.some((p) => urlPath.startsWith(p));

    // Authorization
    const token = skipAuth ? null : localStorage.getItem('token');
    if (token) h.set('Authorization', `Bearer ${token}`);
    else h.delete('Authorization');

    // جلوگیری از preflight برای لاگین: فرم-URL-انکود
    if (urlPath.startsWith('/auth/login')) {
      h.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');

      const d = config.data ?? {};
      if (typeof d === 'object' && !(d instanceof URLSearchParams) && !(d instanceof FormData)) {
        const p = new URLSearchParams();
        Object.entries(d).forEach(([k, v]) => p.append(k, String(v ?? '')));
        config.data = p;
      }
    } else if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
      h.set('Content-Type', 'application/json');
    }

    // لاگ تمیز از هدرها
    const fullUrl = buildFullUrl(config);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 [REQ #${id}] ${String(config.method || 'GET').toUpperCase()} ${fullUrl}`);
    console.log('• headers:', {
      ...h.toJSON(), // ✅
      ...(token ? { Authorization: `Bearer ${maskToken(token)}` } : {}),
    });
    if (config.params) {
      console.log('• params (raw):', config.params);
      console.log('• params (qs):', qs.stringify(config.params, { arrayFormat: 'repeat', encodeValuesOnly: true }));
    }
    if (config.data !== undefined) console.log('• body:', formDataToObject(config.data));

    return config;
  },
  (error) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [REQ] setup error:', error);
    return Promise.reject(error);
  }
);

// ---- response ----
api.interceptors.response.use(
  (response) => {
    const id = (response.config as any)._reqId ?? '?';
    const t0 = (response.config as any)._t0 ?? Date.now();
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = Math.round(t1 - t0);
    const fullUrl = buildFullUrl(response.config);

    console.log(`📥 [RES #${id}] ${response.status} ${response.statusText} — ${fullUrl} (${ms} ms)`);
    console.log('• response headers:', response.headers);
    console.log('• response data:', response.data);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return response;
  },
  (error) => {
    try {
      const cfg = error.config || {};
      const id = cfg?._reqId ?? '?';
      const t0 = cfg?._t0 ?? Date.now();
      const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const ms = Math.round(t1 - t0);
      const fullUrl = buildFullUrl(cfg);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`💥 [ERR #${id}] ${fullUrl} (${ms} ms)`);
      if (error.response) {
        console.error('• status:', error.response.status, error.response.statusText);
        console.error('• response headers:', error.response.headers);
        console.error('• response data:', error.response.data);
      } else if (error.request) {
        console.error('• no response received (network/timeout)');
      } else {
        console.error('• setup error:', error.message);
      }
      console.error('• original request config:', {
        method: cfg?.method,
        url: cfg?.url,
        baseURL: cfg?.baseURL,
        headers: cfg?.headers,
        params: cfg?.params,
        data: formDataToObject(cfg?.data),
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (e) {
      console.error('💥 error in error-interceptor:', e);
    }
    return Promise.reject(error);
  }
);

export default api;
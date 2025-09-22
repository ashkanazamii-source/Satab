// src/services/api.ts
import axios from 'axios';
import qs from 'qs';

// یک شمارنده برای هم‌بندی لاگ‌های هر درخواست/پاسخ
let REQ_ID = 0;

const api = axios.create({
  baseURL: 'http://localhost:3000',
  //baseURL: import.meta.env?.VITE_API_BASE || '/api',

  //headers: { 'Content-Type': 'application/json' },

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
  const q = serializedQuery || (config.params ? qs.stringify(config.params, { arrayFormat: 'repeat', encodeValuesOnly: true }) : '');
  return `${base}/${path}${q ? `?${q}` : ''}`;
}

// کمک‌تابع: ماسک‌کردن توکن
function maskToken(tok?: string | null) {
  if (!tok) return undefined;
  if (tok.length <= 10) return tok.replace(/.(?=.{0}$)/g, '*');
  return tok.slice(0, 4) + '...' + tok.slice(-6);
}

// تبدیل FormData به آبجکت برای لاگ
function formDataToObject(fd: any) {
  try {
    if (typeof FormData !== 'undefined' && fd instanceof FormData) {
      const o: Record<string, any> = {};
      (fd as FormData).forEach((v, k) => {
        o[k] = v;
      });
      return o;
    }
  } catch { }
  return fd;
}

// ───────── Request ─────────
api.interceptors.request.use(
  (config) => {
    const id = ++REQ_ID;
    (config as any)._reqId = id;
    (config as any)._t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // ست‌کردن توکن
    const token = localStorage.getItem('token');
    if (token) {
      const h = config.headers as any;
      if (h && typeof h.set === 'function') {
        h.set('Authorization', `Bearer ${token}`);
      } else {
        (h as Record<string, any>)['Authorization'] = `Bearer ${token}`;
      }
    }


    // URL کامل + کوئری سریالایز شده
    const fullUrl = buildFullUrl(config);

    // لاگ کامل درخواست
    // عمداً groupCollapsed نمی‌زنیم که «کم» نشه؛ همه‌چیز باز باشه
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 [REQ #${id}] ${String(config.method || 'GET').toUpperCase()} ${fullUrl}`);
    console.log('• headers:', {
      ...(config.headers || {}),
      ...(token ? { Authorization: `Bearer ${maskToken(token)}` } : {}),
    });
    if (config.params) {
      console.log('• params (raw):', config.params);
      console.log('• params (qs):', qs.stringify(config.params, { arrayFormat: 'repeat', encodeValuesOnly: true }));
    }
    if (config.data !== undefined) {
      const body = formDataToObject(config.data);
      console.log('• body:', body);
    }

    return config;
  },
  (error) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [REQ] setup error:', error);
    return Promise.reject(error);
  }
);

// ───────── Response ─────────
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

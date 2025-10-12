// src/ingest/ingest.controller.ts
import { Body, Controller, Headers, Logger, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { IngestDto } from './dto/ingest.dto';
import { IngestService } from './ingest.service';

const log = new Logger('IngestController');

// --- Helpers for safe logging ---
const safeJson = (v: any, limit = 4000) => {
  try {
    const s = JSON.stringify(v, (k, val) => (typeof val === 'bigint' ? Number(val) : val));
    return s.length > limit ? s.slice(0, limit) + `… [${s.length} bytes total]` : s;
  } catch {
    return String(v);
  }
};
const pick = (o: any, keys: string[]) =>
  keys.reduce((a, k) => (a[k] = (o as any)?.[k], a), {} as Record<string, any>);

@Controller('ingest')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class IngestController {
  constructor(private readonly svc: IngestService) {}

  /** Helper: نرمال‌سازی ورودی ساده به شکل IngestDto + لاگ */
  private normalizeToIngestDto(raw: any): IngestDto {
    const t0 = Date.now();
    const rawPreview = safeJson(raw, 2000);
    log.debug(`normalize: input preview=${rawPreview}`);

    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
      // مسیر قدیمی/استاندارد
      log.debug(`normalize: detected legacy/standard shape with data{}; fields=${Object.keys(raw.data||{}).join(',')}`);
      return raw as IngestDto;
    }

    const vehicle_id = Number(raw?.vehicle_id ?? raw?.vid ?? raw?.VID);
    const lat  = raw?.lat  !== undefined ? Number(raw.lat)  : undefined;
    const lng  = raw?.lng  !== undefined ? Number(raw.lng)  : undefined;

    const ignition = (() => {
      const v = raw?.ignition ?? raw?.IGNITION;
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toUpperCase();
      return ['1','TRUE','ON'].includes(s);
    })();

    const odometer    = raw?.odometer    !== undefined ? Number(raw.odometer)    : undefined;
    const idle_time   = raw?.idle_time   !== undefined ? Number(raw.idle_time)   : undefined;
    const engine_temp = raw?.engine_temp !== undefined ? Number(raw.engine_temp) : undefined;

    const ts        = raw?.ts !== undefined ? Number(raw.ts) : undefined;
    const device_id = raw?.device_id !== undefined ? String(raw.device_id) : undefined;
    const meta      = (raw?.meta && typeof raw.meta === 'object') ? raw.meta : undefined;

    const dto: IngestDto = {
      device_id,
      ts: ts ?? Date.now(),
      meta,
      data: {
        vehicle_id,
        lat,
        lng,
        ignition,
        odometer,
        idle_time,
        engine_temp,
      } as any,
    };

    log.debug(
      `normalize: output dto keys=${Object.keys(dto).join(',')} | data=${safeJson(dto.data, 1000)} | took=${Date.now()-t0}ms`
    );
    return dto;
  }

  // JSON استاندارد (الان ورودی ساده هم می‌پذیرد)
  @Post('json')
  async ingestJson(@Body() raw: any, @Headers() headers: Record<string, any>) {
    const t0 = Date.now();
    log.debug(`ingest/json: headers=${safeJson(pick(headers, ['content-type','content-length','user-agent','host']), 500)}`);
    log.debug(`ingest/json: raw body preview=${safeJson(raw, 2000)}`);

    const body = this.normalizeToIngestDto(raw);
    const vid = body?.data?.vehicle_id;
    const lat = body?.data?.lat, lng = body?.data?.lng;

    log.log(`ingest/json: normalized -> vid=${vid} lat=${lat} lng=${lng} ts=${body?.ts ?? 'now'}`);
    log.debug(`ingest/json: dto full=${safeJson(body, 3000)}`);

    try {
      await this.svc.handleJson(body);
      const dur = Date.now() - t0;
      log.debug(`ingest/json: handled ok | vid=${vid} | dur=${dur}ms`);
      return { ok: 1 };
    } catch (e: any) {
      const dur = Date.now() - t0;
      log.error(`ingest/json: ERROR | vid=${vid} | dur=${dur}ms | msg=${e?.message || e}`);
      throw e;
    }
  }

  // متن خام: برای بردهایی که JSON نمی‌فرستند (بدون تغییر منطقی)
  @Post('text')
  async ingestText(@Req() req: any, @Headers('content-type') ct?: string, @Headers() headers?: Record<string, any>) {
    const t0 = Date.now();
    log.debug(`ingest/text: headers=${safeJson(pick(headers||{}, ['content-type','content-length','user-agent','host']), 500)}`);

    const text = typeof req.body === 'string'
      ? req.body
      : (ct?.includes('text') ? String(req.body) : '');

    log.log(`ingest/text: ct=${ct || '(none)'} len=${text?.length ?? 0}`);
    log.debug(`ingest/text: preview="${(text || '').slice(0, 500)}"${(text && text.length>500) ? `… [${text.length} bytes total]` : ''}`);

    try {
      await this.svc.handleText(text);
      const dur = Date.now() - t0;
      log.debug(`ingest/text: handled ok | dur=${dur}ms`);
      return { ok: 1 };
    } catch (e: any) {
      const dur = Date.now() - t0;
      log.error(`ingest/text: ERROR | dur=${dur}ms | msg=${e?.message || e}`);
      throw e;
    }
  }
}

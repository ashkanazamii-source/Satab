// src/ingest/ingest.service.ts
import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IngestDto } from './dto/ingest.dto';
import { VehiclesGateway } from '../vehicles/vehicles.gateway';
import { GeofenceService } from '../geofence/geofence.service';

type ParsedMsg = {
  deviceId?: string;
  vehicleId?: number;
  lat?: number;
  lng?: number;
  ignition?: boolean;
  odometer?: number;
  idle_time?: number;
  tsMs: number;     // normalized ms
  extra?: Record<string, any>;
};

class ReorderBuffer {
  constructor(private windowMs = 8000, private maxBatch = 50) {}
  private map = new Map<number, { items: { tsMs: number; msg: ParsedMsg }[] }>();

  push(vehicleId: number, msg: ParsedMsg, onFlush: (sorted: ParsedMsg[]) => void) {
    const b = this.map.get(vehicleId) ?? { items: [] };
    b.items.push({ tsMs: msg.tsMs, msg });

    const now = Date.now();
    const cutoff = now - this.windowMs;

    const emit: { tsMs: number; msg: ParsedMsg }[] = [];
    const keep: { tsMs: number; msg: ParsedMsg }[] = [];

    for (const it of b.items) (it.tsMs <= cutoff ? emit : keep).push(it);

    // flush by size
    if (keep.length >= this.maxBatch) {
      emit.push(...keep.splice(0, keep.length));
    }

    if (emit.length) {
      emit.sort((a, b) => a.tsMs - b.tsMs);
      onFlush(emit.map(e => e.msg));
    }

    b.items = keep;
    if (b.items.length === 0) this.map.delete(vehicleId);
    else this.map.set(vehicleId, b);
  }

  /** فلش دوره‌ای: آیتم‌های سررسیدشده را بدون نیاز به پیام جدید خارج کن */
  flushDue(onFlush: (vehicleId: number, sorted: ParsedMsg[]) => void) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [vid, b] of this.map) {
      const emit: { tsMs: number; msg: ParsedMsg }[] = [];
      const keep: { tsMs: number; msg: ParsedMsg }[] = [];
      for (const it of b.items) (it.tsMs <= cutoff ? emit : keep).push(it);
      if (emit.length) {
        emit.sort((a, b) => a.tsMs - b.tsMs);
        onFlush(vid, emit.map(e => e.msg));
      }
      b.items = keep;
      if (b.items.length === 0) this.map.delete(vid);
      else this.map.set(vid, b);
    }
  }

  /** فلش همه (برای shutdown) */
  flushAll(onFlush: (vehicleId: number, sorted: ParsedMsg[]) => void) {
    for (const [vid, b] of this.map) {
      if (b.items.length) {
        const sorted = [...b.items].sort((a, b) => a.tsMs - b.tsMs).map(e => e.msg);
        onFlush(vid, sorted);
      }
      this.map.delete(vid);
    }
  }
}

function normalizeTsRaw(ts: number) {
  const n = Number(ts);
  return n >= 1e12 ? n : n * 1000; // sec → ms
}

/** فنس زمانی: policy=reject/clamp از env؛ skewMs از env (مثلاً 3600000 = ±1h) */
function normalizeTsWithFence(inputTs: number, policy: 'reject' | 'clamp', skewMs: number) {
  const now = Date.now();
  let tsMs = normalizeTsRaw(inputTs);
  const min = now - skewMs;
  const max = now + skewMs;
  if (tsMs < min || tsMs > max) {
    if (policy === 'reject') return { ok: false as const, tsMs, reason: 'out_of_fence' as const };
    tsMs = tsMs < min ? min : max;
    return { ok: true as const, tsMs, clamped: true };
  }
  return { ok: true as const, tsMs, clamped: false };
}

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(IngestService.name);
  private readonly rb = new ReorderBuffer(8000);
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly ds: DataSource,
    private readonly geofence: GeofenceService,
    private readonly ws: VehiclesGateway,
  ) {}

  onModuleInit() {
    // فلش دوره‌ای هر 1.5 ثانیه
    this.flushTimer = setInterval(() => {
      this.rb.flushDue((vehicleId, batch) => {
        batch.forEach(msg => this.processOne(vehicleId, msg).catch(e => {
          this.log.error('processOne (dueFlush) failed', e as any);
        }));
      });
    }, 1500).unref?.();
  }

  onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    // فلش نهایی
    this.rb.flushAll((vehicleId, batch) => {
      batch.forEach(msg => { /* در shutdown فقط رها نکن؛ در صورت نیاز sync persist کن */
        // اینجا می‌تونی در صورت حساسیت، sync persist انجام بدی
      });
    });
  }

  async handleJson(body: IngestDto) {
    const policy = (process.env.INGEST_TS_POLICY || 'clamp') as 'reject' | 'clamp';
    const skewMs = Number(process.env.INGEST_TS_SKEW_MS || 3600000); // پیش‌فرض ±1h
    const nf = normalizeTsWithFence(body.ts ?? Date.now(), policy, skewMs);
    if (!nf.ok) {
      this.log.warn(`drop out-of-fence ts: device=${body.device_id} ts=${body.ts}`);
      return;
    }

    const p: ParsedMsg = {
      deviceId: body.device_id,
      vehicleId: body.data?.vehicle_id,
      lat: body.data?.lat,
      lng: body.data?.lng,
      ignition: body.data?.ignition,
      odometer: body.data?.odometer,
      idle_time: body.data?.idle_time,
      tsMs: nf.tsMs,
      extra: { meta: body.meta, data: body.data }
    };

    await this.route(p);
  }

  async handleText(text: string) {
    const kv: Record<string, string> = {};
    text.split(/[,\s]+/).forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const k = pair.slice(0, idx).trim().toUpperCase();
      const v = pair.slice(idx + 1).trim();
      kv[k] = v;
    });

    const policy = (process.env.INGEST_TS_POLICY || 'clamp') as 'reject' | 'clamp';
    const skewMs = Number(process.env.INGEST_TS_SKEW_MS || 3600000);
    const nf = normalizeTsWithFence(Number(kv['TS'] ?? Date.now()), policy, skewMs);
    if (!nf.ok) {
      this.log.warn(`drop out-of-fence ts (text): raw="${text.slice(0,200)}"`);
      return;
    }

    const p: ParsedMsg = {
      deviceId: kv['DEVICE_ID'] || kv['DID'] || kv['IMEI'],
      vehicleId: Number(kv['VEHICLE_ID'] || kv['VID']) || undefined,
      lat: kv['lat'] ? Number(kv['lat']) : (kv['LAT'] ? Number(kv['LAT']) : undefined),
      lng: kv['lng'] ? Number(kv['lng']) : (kv['LNG'] ? Number(kv['LNG']) : undefined),
      ignition: kv['IGNITION'] ? ['1','ON','TRUE'].includes(kv['IGNITION'].toUpperCase()) : undefined,
      odometer: kv['ODOMETER'] ? Number(kv['ODOMETER']) : undefined,
      idle_time: kv['IDLE'] ? Number(kv['IDLE']) : undefined,
      tsMs: nf.tsMs,
      extra: { raw: text }
    };

    await this.route(p);
  }

  private async route(p: ParsedMsg) {
    if (!p.deviceId && !p.vehicleId) {
      this.log.warn('no device_id or vehicle_id in payload');
      throw new NotFoundException('unknown device/vehicle');
    }

    const vehicleId = p.vehicleId ?? await this.mapDeviceToVehicle(p.deviceId!);
    if (!vehicleId) throw new NotFoundException('unknown device');

    this.rb.push(vehicleId, p, (batch) => {
      batch.forEach(msg => this.processOne(vehicleId, msg).catch(e => {
        this.log.error('processOne failed', e as any);
      }));
    });
  }

  private async processOne(vehicleId: number, m: ParsedMsg) {
    const deviceCapturedAtIso = new Date(m.tsMs).toISOString();
    const serverReceivedAtIso = new Date().toISOString();

    // فقط اگر مختصات معتبر داریم
    if (hasValidCoordsMsg(m)) {
      const { lat, lng } = m;

      // Idempotent insert: به شرط داشتن ایندکس یکتا (uq_positions_vid_ts_lat_lng)
      await this.ds.query(
        `INSERT INTO positions (vehicle_id, lat, lng, device_captured_at, server_received_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT uq_positions_vid_ts_lat_lng DO NOTHING`,
        [vehicleId, lat, lng, deviceCapturedAtIso, serverReceivedAtIso],
      );

      // لینک راننده (اختیاری)
      const who = await this.ds.query(
        `SELECT driver_user_id
           FROM driver_assignments
          WHERE vehicle_id = $1 AND active = true
          ORDER BY assigned_at DESC
          LIMIT 1`,
        [vehicleId],
      );
      const driverUserId: number | null = who?.[0]?.driver_user_id ?? null;

      // ژئوفنس: فقط 404 را skip کن
      let inside: boolean | undefined;
      let violated = false;
      try {
        const res = await this.geofence.checkAndRecord(vehicleId, { lat, lng }, driverUserId);
        inside = res.inside;
        violated = res.violated;
      } catch (e: any) {
        if (e?.status !== 404) throw e;
      }

      const dataAny = (m.extra?.data ?? {}) as Record<string, unknown>;
      const speed = typeof dataAny.speed === 'number' ? (dataAny.speed as number) : undefined;
      const heading = typeof dataAny.heading === 'number' ? (dataAny.heading as number) : undefined;

      this.ws.emitVehiclePos(vehicleId, lat, lng, deviceCapturedAtIso, {
        speed,
        heading,
        serverTs: serverReceivedAtIso,
        inside,
      });

      if (violated) {
        this.ws.emitGeofenceViolation(vehicleId, { vehicleId, lat, lng, ts: deviceCapturedAtIso });
      }
    } else {
      this.log.warn(`drop invalid coords: lat=${String(m.lat)} lng=${String(m.lng)} vehicle=${vehicleId}`);
    }

    // رویدادهای غیرمکانی
    if (typeof m.ignition === 'boolean') this.ws.emitIgnition(vehicleId, m.ignition, deviceCapturedAtIso);
    if (typeof m.idle_time === 'number' && Number.isFinite(m.idle_time)) this.ws.emitIdle(vehicleId, m.idle_time, deviceCapturedAtIso);
    if (typeof m.odometer === 'number' && Number.isFinite(m.odometer)) this.ws.emitOdometer(vehicleId, m.odometer, deviceCapturedAtIso);
  }

  private async mapDeviceToVehicle(device_id: string): Promise<number | null> {
    const row = await this.ds.query(
      `SELECT v.id AS vehicle_id
         FROM devices d JOIN vehicles v ON v.device_id = d.id
        WHERE d.public_id = $1 OR d.device_id = $1
        LIMIT 1`,
      [device_id],
    );
    if (!row?.length) return null;
    return row[0].vehicle_id as number;
  }
}

function hasValidCoordsMsg(m: ParsedMsg): m is ParsedMsg & { lat: number; lng: number } {
  return (
    typeof m.lat === 'number' &&
    typeof m.lng === 'number' &&
    Number.isFinite(m.lat) &&
    Number.isFinite(m.lng) &&
    m.lat >= -90 && m.lat <= 90 &&
    m.lng >= -180 && m.lng <= 180
  );
}

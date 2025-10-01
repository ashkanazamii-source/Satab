// src/ingest/ingest.service.ts
import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IngestDto } from './dto/ingest.dto';
import { VehiclesGateway } from '../vehicles/vehicles.gateway';
import { GeofenceService } from '../geofence/geofence.service';
import { VehiclesService } from '../vehicles/vehicles.service'; // +++

type ParsedMsg = {
  deviceId?: string;
  vehicleId?: number;
  lat?: number;
  lng?: number;
  ignition?: boolean;
  odometer?: number;
  idle_time?: number;
  engine_temp?: number;           // +++
  tsMs: number;
  extra?: Record<string, any>;
};


class ReorderBuffer {
  constructor(private windowMs = 8000, private maxBatch = 50,

  ) { }
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
    private readonly vehicles: VehiclesService,               // +++

  ) { }

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
      vehicleId: body.data.vehicle_id,
      lat: body.data.lat,
      lng: body.data.lng,
      ignition: body.data.ignition,
      odometer: body.data.odometer,
      idle_time: body.data.idle_time,
      engine_temp: body.data.engine_temp,     // +++
      tsMs: nf.tsMs,
      extra: { meta: body.meta, data: body.data },
    };

    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      this.log.log(`gps rx json vid=${p.vehicleId} lat=${p.lat} lng=${p.lng} tsMs=${p.tsMs}`);
    } else {
      this.log.log(`no gps json vid=${p.vehicleId} tsMs=${p.tsMs}`);
    }
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
      this.log.warn(`drop out-of-fence ts (text): raw="${text.slice(0, 200)}"`);
      return;
    }

    const vid = Number(kv['VEHICLE_ID'] || kv['VID'])
    if (!Number.isFinite(vid)) throw new NotFoundException('vehicle_id required')

    const p: ParsedMsg = {
      vehicleId: vid,
      lat: kv['LAT'] ? Number(kv['LAT']) : undefined,
      lng: kv['LNG'] ? Number(kv['LNG']) : undefined,
      ignition: kv['IGNITION'] ? ['1', 'ON', 'TRUE'].includes(kv['IGNITION'].toUpperCase()) : undefined,
      odometer: kv['ODOMETER'] ? Number(kv['ODOMETER']) : undefined,
      idle_time: kv['IDLE'] ? Number(kv['IDLE']) : undefined,
      engine_temp: kv['ENGINE_TEMP'] ? Number(kv['ENGINE_TEMP']) : undefined, // +++
      tsMs: nf.tsMs,
      extra: { raw: text },
    };

    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      this.log.log(`gps rx text vid=${p.vehicleId} lat=${p.lat} lng=${p.lng} tsMs=${p.tsMs}`);
    } else {
      this.log.log(`no gps text vid=${p.vehicleId} tsMs=${p.tsMs}`);
    }
    await this.route(p);
  };



  // ingest.service.ts -> route
  private async route(p: ParsedMsg) {
    if (!p.vehicleId) throw new NotFoundException('vehicle_id required');
    this.rb.push(p.vehicleId, p, (batch) => {
      batch.forEach(msg => this.processOne(p.vehicleId!, msg).catch(e => this.log.error('processOne failed', e as any)));
    });
  }


  private async processOne(vehicleId: number, m: ParsedMsg) {
    const deviceCapturedAtIso = new Date(m.tsMs).toISOString();
    const serverReceivedAtIso = new Date().toISOString();

    // 1) Telemetry مستقل از GPS
    if (
      typeof m.ignition === 'boolean' ||
      Number.isFinite(m.idle_time) ||
      Number.isFinite(m.odometer) ||
      Number.isFinite(m.engine_temp)
    ) {
      await this.vehicles.ingestVehicleTelemetry(vehicleId, {
        ignition: m.ignition ?? undefined,
        idle_time: m.idle_time ?? undefined,
        odometer: m.odometer ?? undefined,
        engine_temp: m.engine_temp ?? undefined,
        ts: deviceCapturedAtIso,
      });
    }

    // 2) GPS (در صورت داشتن مختصات معتبر)
    if (hasValidCoordsMsg(m)) {
      const { lat, lng } = m;

      // اختیاری: آرشیو
      await this.ds.query(
        `INSERT INTO positions (vehicle_id, lat, lng, device_captured_at, server_received_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT uq_positions_vid_ts_lat_lng DO NOTHING`,
        [vehicleId, lat, lng, deviceCapturedAtIso, serverReceivedAtIso],
      );

      // بقیه کارها داخل VehiclesService
      await this.vehicles.ingestVehiclePos(vehicleId, lat, lng, deviceCapturedAtIso);
    }
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

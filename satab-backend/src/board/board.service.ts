// board.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { IngestDto } from './dto/ingest.dto';
import { BoardGateway } from './board.gateway';
import { VehiclesGateway } from '../vehicles/vehicles.gateway'; // ← مسیر درست پروژه‌ی خودت

@Injectable()
export class BoardService {
  private readonly log = new Logger(BoardService.name);
  constructor(
    private readonly ws: BoardGateway,            // پخش عمومی (اختیاری)
    private readonly vehiclesWs: VehiclesGateway, // پخش تاپیک‌محور
  ) {}

  async handleIngest(payload: IngestDto | string) {
    const data = typeof payload === 'string'
      ? { raw: payload, ts: Date.now() }
      : payload;

    this.log.verbose(
      `INGEST ${typeof payload === 'string' ? 'text' : 'json'}: ${
        typeof payload === 'string' ? payload.slice(0, 200) : JSON.stringify(payload)
      }`,
    );

    // 1) انتشار عمومی اختیاری (قبلی)
    this.ws.publish('board:data', data);

    // 2) نگاشت به رویدادهای وسیله (namespace: /vehicles)
    try {
      await this.routeToVehicleTopics(data);
    } catch (e) {
      this.log.error('routeToVehicleTopics failed', e as any);
    }

    return { ok: true };
  }

  /**
   * این تابع پیام برد را به فرمت‌های مورد نیاز VehiclesGateway تبدیل و منتشر می‌کند.
   * فرض: اگر JSON استاندارد باشد: { device_id, ts, data:{ lat,lng,speed,ignition,odometer, idle_time } }
   * اگر raw string باشد، نمونه‌ی ساده‌ی key=value, ... را پارس می‌کنیم.
   */
  private async routeToVehicleTopics(input: any) {
    let vehicleId: number | undefined;
    let tsIso: string | undefined;
    let lat: number | undefined;
    let lng: number | undefined;
    let ignition: boolean | undefined;
    let odometer: number | undefined;
    let idle_time: number | undefined;

    if (typeof input === 'string' || input.raw) {
      const raw = typeof input === 'string' ? input : String(input.raw ?? '');
      const kv: Record<string, string> = {};
      raw.split(/[,\s]+/).forEach(pair => {
        const [k, v] = pair.split('=');
        if (!k) return;
        kv[k.trim().toUpperCase()] = (v ?? '').trim();
      });
      // نگاشت اولیه (با توجه به فرمت واقعی برد اصلاحش کن)
      if (kv['VID']) vehicleId = Number(kv['VID']);
      if (kv['VEHICLE_ID']) vehicleId = Number(kv['VEHICLE_ID']);
      if (kv['LAT']) lat = Number(kv['LAT']);
      if (kv['LNG']) lng = Number(kv['LNG']);
      if (kv['IGNITION']) ignition = ['1','ON','TRUE'].includes(kv['IGNITION'].toUpperCase());
      if (kv['ODOMETER']) odometer = Number(kv['ODOMETER']);
      if (kv['IDLE'] || kv['IDLE_TIME']) idle_time = Number(kv['IDLE'] ?? kv['IDLE_TIME']);
      tsIso = new Date(input.ts ?? Date.now()).toISOString();
    } else {
      // JSON استاندارد پیشنهادی
      // { device_id: 'dev-1', ts: 1732211111, data: { vehicle_id, lat, lng, ignition, odometer, idle_time } }
      const tsNum = Number(input.ts ?? Date.now());
      tsIso = new Date(tsNum >= 1e12 ? tsNum : tsNum * 1000).toISOString();
      vehicleId = Number(input.data?.vehicle_id ?? input.vehicle_id ?? input.vid);
      lat = input.data?.lat ?? input.lat;
      lng = input.data?.lng ?? input.lng;
      ignition = input.data?.ignition ?? input.ignition;
      odometer = input.data?.odometer ?? input.odo;
      idle_time = input.data?.idle_time ?? input.idle_time;
    }

    if (!vehicleId) {
      this.log.warn('No vehicle_id in payload; skip /vehicles emits.');
      return;
    }

    // حالا مطابق Gateway تو رویدادها را منتشر کن:

    if (lat != null && lng != null) {
      this.vehiclesWs.emitVehiclePos(vehicleId, Number(lat), Number(lng), tsIso!);
    }

    if (typeof ignition === 'boolean') {
      this.vehiclesWs.emitIgnition(vehicleId, Boolean(ignition), tsIso);
    }

    if (typeof idle_time === 'number' && !Number.isNaN(idle_time)) {
      this.vehiclesWs.emitIdle(vehicleId, Number(idle_time), tsIso);
    }

    if (typeof odometer === 'number' && !Number.isNaN(odometer)) {
      this.vehiclesWs.emitOdometer(vehicleId, Number(odometer), tsIso);
    }

    // اگر دیتای ایستگاه‌ها (stations) داری، می‌تونی اینجا صدا بزنی:
    // this.vehiclesWs.emitStationsChanged(vehicleId, ownerUserId, { stations: [...] });
  }
}

// src/telemetry/telemetry.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GeofenceService } from '../geofence/geofence.service';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly ds: DataSource,
    private readonly geofence: GeofenceService,
  ) {}

  /** ذخیرهٔ نقطه + چک ژئوفنس + ثبت تخلف (توسط GeofenceService) */
  async ingestPosition(evt: { device_id: string; lat: number; lng: number; ts?: number }) {
    const { device_id, lat, lng } = evt;

    // 1) Map device → vehicle
    const row = await this.ds.query(
      `SELECT v.id AS vehicle_id
         FROM devices d JOIN vehicles v ON v.device_id = d.id
        WHERE d.public_id = $1 OR d.device_id = $1
        LIMIT 1`,
      [device_id],
    );
    if (!row?.length) return; // ناشناخته؛ می‌تونی لاگ کنی

    const vehicleId: number = row[0].vehicle_id;

    // 2) ذخیره موقعیت (مثلاً جدول positions)
    await this.ds.query(
      `INSERT INTO positions (vehicle_id, lat, lng, captured_at)
       VALUES ($1, $2, $3, NOW())`,
      [vehicleId, lat, lng],
    );

    // 3) پیدا کردن رانندهٔ فعلی (اختیاری ولی بهتر برای لینک تخلف)
    const who = await this.ds.query(
      `SELECT driver_user_id
         FROM driver_assignments
        WHERE vehicle_id = $1 AND active = true
        ORDER BY assigned_at DESC
        LIMIT 1`,
      [vehicleId],
    );
    const driverUserId: number | null = who?.[0]?.driver_user_id ?? null;

    // 4) چک ژئوفنس + ثبت تخلف (داخل خودش INSERT می‌زند)
    await this.geofence.checkAndRecord(vehicleId, { lat, lng }, driverUserId);

    // 5) (اختیاری) نوتیف هم‌زمان به UI از طریق WebSocket/RedisPubSub
    // if (violated) gateway.broadcast(...);
  }
}

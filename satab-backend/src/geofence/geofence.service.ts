import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GeofenceEntity } from './geofence.entity';
import { CreateGeofenceDto, UpdateGeofenceDto } from '../dto/create-geofence.dto';
import { ViolationsService } from '../violations/violations.service';
import { insidePolygonWithTolerance, insideCircleWithTolerance, LatLng } from './geo.util';

type CheckResult = { inside: boolean; reason: 'inside' | 'near-edge' | 'outside'; distanceM?: number };

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(GeofenceEntity) private readonly repo: Repository<GeofenceEntity>,
    private readonly violations: ViolationsService,
    private readonly ds: DataSource,
  ) { }

  async getForVehicle(vehicleId: number): Promise<GeofenceEntity | null> {
    return this.repo.findOne({ where: { vehicleId } });
  }

  async upsertForVehicle(vehicleId: number, dto: CreateGeofenceDto | UpdateGeofenceDto) {
    // اعتبارسنجی سخت‌گیرانه
    if (dto.type === 'polygon') {
      if (!dto.polygonPoints || dto.polygonPoints.length < 3) {
        throw new BadRequestException('polygonPoints (>=3) لازم است.');
      }
      for (const p of dto.polygonPoints) {
        if (
          !(typeof p.lat === 'number' && p.lat >= -90 && p.lat <= 90) ||
          !(typeof p.lng === 'number' && p.lng >= -180 && p.lng <= 180)
        ) {
          throw new BadRequestException('مختصات پلیگون نامعتبر است.');
        }
      }
    } else if (dto.type === 'circle') {
      if (
        dto.centerLat == null ||
        dto.centerLng == null ||
        dto.radiusM == null ||
        dto.radiusM <= 0
      ) {
        throw new BadRequestException('centerLat/centerLng/radiusM لازم است.');
      }
      if (dto.centerLat < -90 || dto.centerLat > 90 || dto.centerLng < -180 || dto.centerLng > 180) {
        throw new BadRequestException('مختصات مرکز دایره نامعتبر است.');
      }
    }

    const prev = await this.getForVehicle(vehicleId);
    const nextType = dto.type ?? prev?.type;
    if (!nextType) throw new BadRequestException('type لازم است (polygon|circle).');

    const next = this.repo.create({
      ...(prev ?? {}),
      vehicleId, // number
      type: nextType,
      polygonPoints:
        nextType === 'polygon'
          ? (dto.polygonPoints ?? (prev?.type === 'polygon' ? prev?.polygonPoints ?? null : null))
          : null,
      centerLat:
        nextType === 'circle'
          ? (dto.centerLat ?? (prev?.type === 'circle' ? prev?.centerLat ?? null : null))
          : null,
      centerLng:
        nextType === 'circle'
          ? (dto.centerLng ?? (prev?.type === 'circle' ? prev?.centerLng ?? null : null))
          : null,
      radiusM:
        nextType === 'circle'
          ? (dto.radiusM ?? (prev?.type === 'circle' ? prev?.radiusM ?? null : null))
          : null,
      toleranceM: dto.toleranceM ?? prev?.toleranceM ?? 5,
      outsideN: dto.outsideN ?? prev?.outsideN ?? 1,
      cooldownMs: dto.cooldownMs ?? prev?.cooldownMs ?? 60000,
      active: dto.active ?? prev?.active ?? true,
    });

    return this.repo.save(next);
  }

  private checkPointRaw(geo: GeofenceEntity, p: LatLng): CheckResult {
    if (!geo.active) return { inside: true, reason: 'inside' };

    const tol = Math.max(0, geo.toleranceM ?? 0);

    if (geo.type === 'polygon') {
      const poly = (geo.polygonPoints || []) as LatLng[];
      const inside = insidePolygonWithTolerance(p, poly, tol);
      return { inside, reason: inside ? 'inside' : 'outside' };
    }

    const center = { lat: geo.centerLat!, lng: geo.centerLng! };
    const inside = insideCircleWithTolerance(p, center, geo.radiusM!, tol);
    return { inside, reason: inside ? 'inside' : 'outside' };
  }

  /**
   * اتمیک روی DB با قفل ردیفی در جدول geofence_runtime:
   * - اگر داخل: صفر کردن شمارنده
   * - اگر بیرون: افزایش شمارنده + چک threshold & cooldown → ثبت تخلف
   *
   * نیاز به جدول:
   *   CREATE TABLE IF NOT EXISTS geofence_runtime (
   *     vehicle_id INT PRIMARY KEY,
   *     outside_cnt INT NOT NULL DEFAULT 0,
   *     last_violation_at timestamptz NULL,
   *     updated_at timestamptz NOT NULL DEFAULT now()
   *   );
   */
  async checkAndRecord(
    vehicleId: number,
    p: LatLng,
    driverUserId?: number | null,
  ): Promise<{ inside: boolean; violated: boolean }> {
    const geo = await this.getForVehicle(vehicleId);
    if (!geo) throw new NotFoundException('ژئوفنس تنظیم نشده.');

    const { inside } = this.checkPointRaw(geo, p);

    if (inside) {
      await this.ds.query(
        `INSERT INTO geofence_runtime (vehicle_id, outside_cnt, last_violation_at, updated_at)
         VALUES ($1, 0, NULL, now())
         ON CONFLICT (vehicle_id)
         DO UPDATE SET outside_cnt = 0, updated_at = now()`,
        [vehicleId],
      );
      return { inside: true, violated: false };
    }

    const violated = await this.ds.transaction<boolean>(async (trx) => {
      // قفل ردیفی برای اتمی بودن
      const row = await trx.query(
        `SELECT vehicle_id, outside_cnt, last_violation_at
           FROM geofence_runtime
          WHERE vehicle_id = $1
          FOR UPDATE`,
        [vehicleId],
      );

      let outside_cnt = row?.[0]?.outside_cnt ?? 0;
      const last_at: Date | null = row?.[0]?.last_violation_at ?? null;
      outside_cnt += 1;

      if (!row?.length) {
        await trx.query(
          `INSERT INTO geofence_runtime (vehicle_id, outside_cnt, last_violation_at, updated_at)
           VALUES ($1, $2, NULL, now())
           ON CONFLICT (vehicle_id) DO NOTHING`,
          [vehicleId, outside_cnt],
        );
      } else {
        await trx.query(
          `UPDATE geofence_runtime
              SET outside_cnt = $2, updated_at = now()
            WHERE vehicle_id = $1`,
          [vehicleId, outside_cnt],
        );
      }

      const outsideN = geo.outsideN ?? 1;
      const cooldownMs = geo.cooldownMs ?? 60000;
      const now = Date.now();
      const lastMs = last_at ? new Date(last_at).getTime() : 0;
      const cooldownOk = now - lastMs >= cooldownMs;

      if (outside_cnt >= outsideN && cooldownOk) {
        await this.violations.addGeofenceExit({
          vehicleId,                                // number
          driverUserId: driverUserId ?? null,       // number|null
          meta: {
            geofence_id: geo.id,
            point: p,
            type: geo.type,
            tolerance_m: geo.toleranceM,
            outside_n: geo.outsideN,
          },
        });

        await trx.query(
          `UPDATE geofence_runtime
              SET outside_cnt = 0, last_violation_at = now(), updated_at = now()
            WHERE vehicle_id = $1`,
          [vehicleId],
        );
        return true;
      }
      return false;
    });

    return { inside: false, violated };
  }
  async deleteForVehicle(vehicleId: number): Promise<number> {
    const res = await this.repo.delete({ vehicleId });
    // پاک‌کردن شمارنده/آخرین تخلف از جدول رانتایم (اگر ساختی)
    await this.ds.query(
      `DELETE FROM geofence_runtime WHERE vehicle_id = $1`,
      [vehicleId],
    );
    return res.affected ?? 0;
  }
}

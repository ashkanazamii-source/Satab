import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeofenceEntity } from './geofence.entity';
import { CreateGeofenceDto, UpdateGeofenceDto } from '../dto/create-geofence.dto';
import { ViolationsService } from '../telemetry/violations.service'; // یا ../violations/violations.service
import { insidePolygonWithTolerance, insideCircleWithTolerance, LatLng } from './geo.util';

type CheckResult = { inside: boolean; reason: 'inside' | 'near-edge' | 'outside'; distanceM?: number };

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(GeofenceEntity) private repo: Repository<GeofenceEntity>,
    private violations: ViolationsService,
  ) {}

  private outsideCounts = new Map<number, number>();
  private lastViolationAt = new Map<number, number>();

  async getForVehicle(vehicleId: number): Promise<GeofenceEntity | null> {
    return this.repo.findOne({ where: { vehicleId } });
  }

  async upsertForVehicle(vehicleId: number, dto: CreateGeofenceDto | UpdateGeofenceDto) {
    if (dto.type === 'polygon') {
      if (!dto.polygonPoints || dto.polygonPoints.length < 3) {
        throw new BadRequestException('polygonPoints (>=3) لازم است.');
      }
    } else if (dto.type === 'circle') {
      if (dto.centerLat == null || dto.centerLng == null || dto.radiusM == null || dto.radiusM <= 0) {
        throw new BadRequestException('centerLat/centerLng/radiusM لازم است.');
      }
    }

    const prev = await this.getForVehicle(vehicleId);
    const next = this.repo.create({
      ...(prev ?? {}),
      vehicleId,
      type: dto.type ?? prev?.type,
      polygonPoints: dto.type === 'polygon' ? (dto.polygonPoints as any) : null,
      centerLat: dto.type === 'circle' ? dto.centerLat! : null,
      centerLng: dto.type === 'circle' ? dto.centerLng! : null,
      radiusM: dto.type === 'circle' ? dto.radiusM! : null,
      toleranceM: dto.toleranceM ?? prev?.toleranceM ?? 5,
      outsideN: dto.outsideN ?? prev?.outsideN ?? 1,
      cooldownMs: dto.cooldownMs ?? prev?.cooldownMs ?? 60000,
      active: dto.active ?? prev?.active ?? true,
    });
    return this.repo.save(next);
  }

  async deleteForVehicle(vehicleId: number) {
    const res = await this.repo.delete({ vehicleId });
    this.outsideCounts.delete(vehicleId);
    this.lastViolationAt.delete(vehicleId);
    return res.affected ?? 0;
  }

  checkPointRaw(geo: GeofenceEntity, p: LatLng): CheckResult {
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

  async checkAndRecord(
    vehicleId: number,
    p: LatLng,
    driverUserId?: number | null,
  ): Promise<{ inside: boolean; violated: boolean }> {
    const geo = await this.getForVehicle(vehicleId);
    if (!geo) throw new NotFoundException('ژئوفنس تنظیم نشده.');

    const { inside } = this.checkPointRaw(geo, p);

    if (inside) {
      if (this.outsideCounts.has(vehicleId)) this.outsideCounts.set(vehicleId, 0);
      return { inside: true, violated: false };
    }

    // خارج
    const cnt = (this.outsideCounts.get(vehicleId) ?? 0) + 1;
    this.outsideCounts.set(vehicleId, cnt);

    if (cnt >= (geo.outsideN ?? 3)) {
      const now = Date.now();
      const last = this.lastViolationAt.get(vehicleId) ?? 0;

      if (now - last >= (geo.cooldownMs ?? 60000)) {
        // ✅ ثبت از طریق سرویس
        await this.violations.addGeofenceExit({
          vehicleId,
          driverUserId: driverUserId ?? null,
          meta: {
            geofence_id: geo.id,
            point: p,
            type: geo.type,
            tolerance_m: geo.toleranceM,
            outside_n: geo.outsideN,
          },
        });

        this.lastViolationAt.set(vehicleId, now);
        this.outsideCounts.set(vehicleId, 0);
        return { inside: false, violated: true };
      }
      return { inside: false, violated: false };
    }

    return { inside: false, violated: false };
  }
}

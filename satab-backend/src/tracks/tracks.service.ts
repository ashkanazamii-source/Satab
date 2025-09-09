import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DriverRoute } from '../drivers/driver-route.entity';

type GetTrackParams = {
  driverId?: number;
  vehicleId?: number;
  from?: string | Date;
  to?: string | Date;
};

@Injectable()
export class TracksService {
  constructor(
    @InjectRepository(DriverRoute)
    private readonly routeRepo: Repository<DriverRoute>,
  ) {}

  /** نقاط مسیر را از DriverRouteهای بازه زمانی استخراج می‌کند */
  async getTrackPoints(params: GetTrackParams) {
    const where: any = {};
    if (params.driverId) where.driver_id = params.driverId;
    if (params.vehicleId) where.vehicle_id = params.vehicleId;

    const from = params.from ? new Date(params.from) : new Date('1970-01-01T00:00:00Z');
    const to   = params.to   ? new Date(params.to)   : new Date();

    where.started_at = Between(from, to);

    const routes = await this.routeRepo.find({
      where,
      order: { started_at: 'ASC' },
    });

    // خروجی ساده: آرایه‌ای از {lat,lng,ts}
    const points = routes.flatMap(r =>
      (r.gps_points || []).map((p: any) => ({
        lat: p.lat,
        lng: p.lng,
        ts:  p.timestamp ?? r.started_at, // اگر timestamp روی پوینت نبود
      })),
    );

    return points;
  }
}

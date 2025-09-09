// driver-routes.ingest.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteGateway } from './driver-route.gateway';

@Controller('driver-routes/ingest')
export class DriverRouteIngestController {
  constructor(
    private readonly service: DriverRouteService,
    private readonly gw: DriverRouteGateway,
  ) {}

  @Post('pos')
  async ingestPos(
    @Body() body: { routeId: number; lat: number; lng: number; ts?: string },
  ) {
    const { routeId, lat, lng, ts } = body; 
    const saved = await this.service.addPoint(routeId, { lat, lng, ts });

    // همان چیزی که Gateway در WS انجام می‌داد:
    const payload = {
      routeId,
      driverId: saved.driver_id,
      lat,
      lng,
      ts: ts ?? new Date().toISOString(),
    };
    this.gw.server.to(`route:${routeId}`).emit('driver_location_update', payload);
    const sa = await (this.gw as any).findSuperAdminForDriver(saved.driver_id);
    if (sa) this.gw.server.to(`user:${sa.id}`).emit('driver_location_update', payload);
    this.gw.server.to('managers').emit('driver_location_update', payload);
    this.gw.server.to(`user:${saved.driver_id}`).emit('driver_location_update_self', payload);

    return { ok: true };
  }
}

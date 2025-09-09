// vehicles.ingest.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles/ingest')
export class VehiclesIngestController {
  constructor(private readonly service: VehiclesService) {}

  @Post('pos')
  async ingestPos(@Body() body: { vehicleId: number; lat: number; lng: number; ts?: string }) {
    await this.service.ingestVehiclePos(body.vehicleId, body.lat, body.lng, body.ts);
    return { ok: true };
  }
  @Post('telemetry')
ingestTelemetry(@Body() b: { vehicleId: number; ignition?: boolean; idle_time?: number; odometer?: number; ts?: string }) {
  return this.service.ingestVehicleTelemetry(b.vehicleId, b);
}
}

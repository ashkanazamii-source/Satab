// src/telemetry/telemetry.module.ts
import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { GeofenceModule } from '../geofence/geofence.module'; // ماژولی که GeofenceService را export می‌کند

@Module({
  imports: [GeofenceModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
})
export class TelemetryModule {}

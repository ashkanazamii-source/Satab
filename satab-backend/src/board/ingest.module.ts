// src/ingest/ingest.module.ts
import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

import { GeofenceModule } from '../geofence/geofence.module'; // ✅ می‌آورد GeofenceService
import { VehiclesModule } from '../vehicles/vehicles.module'; // ✅ می‌آورد VehiclesGateway

@Module({
  imports: [
    GeofenceModule,
    VehiclesModule,
  ],
  controllers: [IngestController],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}

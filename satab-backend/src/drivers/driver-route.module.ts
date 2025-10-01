import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DriverRoute } from './driver-route.entity';
import { Users } from '../users/users.entity';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteGateway } from './driver-route.gateway';
import { DriverRouteController } from './driver-route.controller';
import { DriverRouteIngestController } from './driver-routes.ingest.controller';
import { VehicleDailyTrack } from '../vehicles/vehicle_daily_tracks.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverRoute, Users, VehicleDailyTrack]),
  ],
  controllers: [
    DriverRouteController,
    DriverRouteIngestController,
  ],
  providers: [
    DriverRouteService,
    DriverRouteGateway,
  ],
  exports: [
    DriverRouteService,
  ],
})
export class DriverRouteModule {}

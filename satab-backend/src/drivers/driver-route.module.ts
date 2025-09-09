// src/driver-route/driver-route.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverRoute } from './driver-route.entity';
import { Users } from '../users/users.entity';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteController } from './driver-route.controller';
import { DriverRouteGateway } from './driver-route.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([DriverRoute, Users])],
  providers: [DriverRouteService, DriverRouteGateway],
  controllers: [DriverRouteController],
  exports: [DriverRouteService],
})
export class DriverRouteModule {}

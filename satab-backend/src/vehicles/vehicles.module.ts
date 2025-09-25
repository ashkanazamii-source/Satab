// src/vehicles/vehicles.module.ts (نسخه اصلاح‌شده)

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Vehicle } from './vehicle.entity';
import { VehicleDailyTrack } from './vehicle_daily_tracks.entity';
import { VehicleStation } from './vehicle-station.entity';
import { Route } from './route.entity';
import { RouteStation } from './route-station.entity';
import { RouteGeofenceEvent } from './route-geofence-event.entity';
import { RouteGeofenceState } from './route-geofence-state.entity';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';

// Services, Controllers, Gateways
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { RoutesController } from './route.controller';
import { VehiclesGateway } from './vehicles.gateway';

// Modules
import { UserModule } from '../users/users.module';
import { VehiclePoliciesModule } from '../vehicle-policies/vehicle-policies.module';
import { ViolationsModule } from '../telemetry/violations.module';
import { DriverVehicleAssignmentModule } from '../driver-vehicle-assignment/driver-vehicle-assignment.module';
import { DriverRouteModule } from '../drivers/driver-route.module';
import { RolePermissionModule } from '../permissions/role-permission.module'; // ✅ ایمپورت کردن ماژول دسترسی‌ها

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      VehicleDailyTrack,
      VehicleStation,
      Route,
      RouteStation,
      RouteGeofenceState,
      RouteGeofenceEvent,
      VehiclePolicy,
    ]),
    
    forwardRef(() => DriverRouteModule),
    UserModule,
    VehiclePoliciesModule,
    ViolationsModule,
    DriverVehicleAssignmentModule,
    RolePermissionModule, // ✅✅✅ این ماژول باید اینجا ایمپورت شود ✅✅✅
  ],
  controllers: [
    VehiclesController,
    RoutesController
  ],
  providers: [
    VehiclesService,
    VehiclesGateway
  ],
  exports: [
    VehiclesService
  ],
})
export class VehiclesModule {}
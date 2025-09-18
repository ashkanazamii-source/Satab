import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './vehicle.entity';
import { VehicleTrack } from './vehicle-track.entity';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';
import { VehicleStation } from './vehicle-station.entity';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesGateway } from './vehicles.gateway';
import { RolePermissionModule } from '../permissions/role-permission.module';
import { Route } from './route.entity';
import { RouteStation } from './route-station.entity';
import { RoutesController } from './route.controller';
import { VehiclePoliciesModule } from '../vehicle-policies/vehicle-policies.module';
import { UserModule } from '../users/users.module'; // همونی که ساختی و UserService رو export می‌کنه
import { RouteGeofenceEvent } from './route-geofence-event.entity'; // همونی که ساختی و UserService رو export می‌کنه
import { RouteGeofenceState } from './route-geofence-state.entity'; // همونی که ساختی و UserService رو export می‌کنه

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      VehicleTrack,
      VehiclePolicy,  // می‌تونه بمونه، ولی ضروری نیست
      VehicleStation,
      Route,
      RouteStation,
      RouteGeofenceState, RouteGeofenceEvent, // ⬅️ جدید

    ]),
    RolePermissionModule,
    VehiclePoliciesModule, // ✅ فقط ماژول رو ایمپورت کن
    UserModule,            // ✅ برای تزریق UserService
  ],
  controllers: [VehiclesController, RoutesController],
  providers: [
    VehiclesService,
    VehiclesGateway,
    // ❌ این خط رو حتماً حذف کن:
    // VehiclePoliciesService,
  ],
  exports: [VehiclesService],
})
export class VehiclesModule { }

// src/driver-vehicle-assignment/driver-vehicle-assignment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DriverVehicleAssignmentService } from './driver-vehicle-assignment.service';
import { DriverVehicleAssignmentController } from './driver-vehicle-assignment.controller';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverVehicleAssignment, Users, Vehicle])],
  controllers: [DriverVehicleAssignmentController],
  providers: [DriverVehicleAssignmentService],
  exports: [DriverVehicleAssignmentService],
})
export class DriverVehicleAssignmentModule {}

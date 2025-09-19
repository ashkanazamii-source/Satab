// src/driver-vehicle-assignment/driver-vehicle-assignment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DriverVehicleAssignmentService } from './driver-vehicle-assignment.service';
import { DriverVehicleAssignmentController } from './driver-vehicle-assignment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverVehicleAssignment])],
  controllers: [DriverVehicleAssignmentController],
  providers: [DriverVehicleAssignmentService],
  exports: [DriverVehicleAssignmentService], // ⬅️ برای تزریق در سرویس‌های دیگر
})
export class DriverVehicleAssignmentModule {}

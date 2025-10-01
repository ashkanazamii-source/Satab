import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { DriverVehicleAssignmentService } from './driver-vehicle-assignment.service';
import { DriverVehicleAssignmentController } from './driver-vehicle-assignment.controller';
import { Vehicle } from '../vehicles/vehicle.entity';
import { DriverRouteModule } from '../drivers/driver-route.module'; // مسیر درست خودت

@Module({
  imports: [
    // ✅ Vehicle را هم اضافه کن تا @InjectRepository(Vehicle) کار کند
    TypeOrmModule.forFeature([DriverVehicleAssignment, Vehicle]),
    // ✅ چون DriverRouteService را تزریق می‌کنی
    forwardRef(() => DriverRouteModule),
  ],
  controllers: [DriverVehicleAssignmentController],
  providers: [DriverVehicleAssignmentService],
  exports: [DriverVehicleAssignmentService],
})
export class DriverVehicleAssignmentModule {}

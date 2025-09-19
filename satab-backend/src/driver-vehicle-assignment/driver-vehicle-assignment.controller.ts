// src/driver-vehicle-assignment/driver-vehicle-assignment.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { DriverVehicleAssignmentService } from './driver-vehicle-assignment.service';
import { StartAssignmentDto, EndAssignmentDto } from '../dto/assign.dto';

@Controller('assignments')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class DriverVehicleAssignmentController {
  constructor(private readonly service: DriverVehicleAssignmentService) {}

  @Post('start')
  start(@Body() dto: StartAssignmentDto) {
    return this.service.startAssignment(dto.driverId, dto.vehicleId);
  }

  @Post('end')
  end(@Body() dto: EndAssignmentDto) {
    return this.service.endAssignment(dto.driverId);
  }

  @Get('current/:driverId')
  current(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getCurrentAssignment(driverId);
  }

  @Get('history/:driverId')
  history(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.history(driverId);
  }
}

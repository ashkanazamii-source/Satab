// src/violations/violations.controller.ts  (برای مصرف فرانت)
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ViolationsService } from './violations.service';

@Controller()
export class ViolationsController {
  constructor(private readonly svc: ViolationsService) {}

  @Get('vehicles/:vehicleId/violations')
  listForVehicle(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Query('limit') limit = 50,
  ) {
    return this.svc.findByVehicle(vehicleId, Number(limit) || 50);
  }

  @Get('violations/recent')
  recent(@Query('limit') limit = 50) {
    return this.svc.latest(Number(limit) || 50);
  }
}

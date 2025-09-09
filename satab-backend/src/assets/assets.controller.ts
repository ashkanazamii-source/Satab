// src/assets/assets.controller.ts
import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AssetsService } from './assets.service';

@Controller('assets')
// @UseGuards(JwtAuthGuard, AclGuard, LicenseGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Post('vehicles')
  createVehicle(@Req() req, @Body() dto: any) {
    return this.service.createVehicle(req.user, dto);
  }

  @Post('devices')
  createDevice(@Req() req, @Body() dto: any) {
    return this.service.createDevice(req.user, dto);
  }

  @Get('vehicles/my-subtree')
  myVehicles(@Req() req) {
    return this.service.listVehiclesInMySubtree(req.user.id);
  }

  @Get('devices/my-subtree')
  myDevices(@Req() req) {
    return this.service.listDevicesInMySubtree(req.user.id);
  }
}

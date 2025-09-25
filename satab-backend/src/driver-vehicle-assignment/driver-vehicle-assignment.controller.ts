// src/driver-vehicle-assignment/driver-vehicle-assignment.controller.ts
import {
  Body, Controller, Get, Param, ParseIntPipe, Post,
  UsePipes, ValidationPipe, UseGuards, UnauthorizedException, ForbiddenException,
  Query
} from '@nestjs/common';
import { DriverVehicleAssignmentService } from './driver-vehicle-assignment.service';
import { StartAssignmentDto, EndAssignmentDto } from '../dto/assign.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Users } from '../users/users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';        // ⬅️ اضافه
import { AclGuard } from '../acl/acl.guard';                   // (اختیاری) اگر ACL داری
import { ACL } from '../acl/acl.decorator';                    // (اختیاری)

@Controller('assignments')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@UseGuards(JwtAuthGuard) // ⬅️ کل روتر لاگین می‌خواهد
export class DriverVehicleAssignmentController {
  constructor(private readonly service: DriverVehicleAssignmentService) { }

  @Post('start')
  start(@Body() dto: StartAssignmentDto) {
    return this.service.startAssignment(dto.driverId, dto.vehicleId);
  }
  @Get('by-vehicle-at')
  async driverByVehicleAt(
    @Query('vehicle_id', ParseIntPipe) vehicleId: number,
    @Query('at') at?: string,
  ) {
    const when = at ? new Date(at) : new Date();
    const driverId = await this.service.getDriverByVehicleAt(vehicleId, when);
    return { vehicle_id: vehicleId, at: when.toISOString(), driver_id: driverId };
  }
  @Post('end')
  end(@Body() dto: EndAssignmentDto) {
    return this.service.endAssignment(dto.driverId);
  }

  @Get('current/:driverId')
  current(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getCurrentAssignment(driverId);
  }

  // فقط سوپرادمین‌ها ببینند (اختیاری: اگر ACL داری فعال کن)
  // @UseGuards(AclGuard)
  // @ACL({ roles: [2] })
  @Get('today-for-me')
  async todayForMe(@CurrentUser() me?: Users) {
    if (!me?.id) throw new UnauthorizedException('توکن معتبر نیست یا کاربر یافت نشد.');
    // اگر لازم داری مطمئن شی SA است:
    // if (me.role_level !== 2) throw new ForbiddenException('فقط سوپرادمین.');
    return this.service.listTodayForSuperAdmin(me.id);
  }

  @Get('history/:driverId')
  history(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.history(driverId);
  }
}

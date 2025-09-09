// vehicle-policies.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UsePipes, ValidationPipe, Req, UseGuards } from '@nestjs/common';
import { VehiclePoliciesService } from './vehicle-policies.service';
import { UpdateVehiclePoliciesDto } from '../dto/update-vehicle-policies.dto';
import { SetBoundedVehiclePoliciesDto } from '../dto/update-vehicle-policies.dto';
import { ACL } from '../acl/acl.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
@UseGuards(JwtAuthGuard, AclGuard)
@Controller('vehicle-policies')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class VehiclePoliciesController {
  constructor(private readonly service: VehiclePoliciesService) { }

  // 1) گرفتن سیاست‌های یک کاربر (اختیاری: فقط Allowed)
  @Get('user/:id')
  getUserPolicies(
    @Param('id', ParseIntPipe) id: number,
    @Query('onlyAllowed') onlyAllowed?: string,
  ) {
    return this.service.getForUser(id, onlyAllowed === 'true');
  }

  // 2) ثبت/آپدیت سیاست‌های یک کاربر (مدیرکل روی SA)
  @Put('user/:id')
  @ACL({ roles: [1] }) // فقط MANAGER
  updateUserPolicies(
    @Req() req,                                  // ⬅️ اضافه
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateVehiclePoliciesDto,
  ) {
    return this.service.upsertForUser(id, body, req.user?.id);  // ⬅️ actorUserId
  }



  // 3) قابل‌واگذاری‌های کاربر جاری (برای SA در فرانت)
  @Get('grantable')
  @ACL({ roles: [1, 2] })
  getGrantable(@Req() req) {
    return this.service.getGrantableForUser(req.user.id);
  }

  // 4) SA: واگذاری «محدود» به زیرمجموعه
  @Put('user/:id/bounded')
  @ACL({ roles: [1, 2] })
  setBounded(
    @Req() req,
    @Param('id', ParseIntPipe) targetUserId: number,
    @Body() body: SetBoundedVehiclePoliciesDto,
  ) {
    const converted = {
      policies: body.policies.map(p => ({
        ...p,
        max_count: 0, // چون bounded از granter محاسبه میشه
      })),
    };
    return this.service.updatePoliciesBounded(
      req.user.id,
      targetUserId,
      converted,
    );
  }
}

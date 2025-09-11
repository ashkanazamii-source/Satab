import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe, DefaultValuePipe, ParseIntPipe, ParseEnumPipe, } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
import { ACL } from '../acl/acl.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Users } from '../users/users.entity';
enum Bucket { day='day', week='week', month='month' }

@Controller('analytics')
@UseGuards(JwtAuthGuard, AclGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) { }

  /**
   * 🌳 درخت آنالیز: نود هدف + خلاصه خودش + «فقط زیرمجموعه‌های مستقیم» با خلاصه هر کدام.
   * اگر userId ندهی، نود هدف = خود کاربر لاگین‌شده.
   */
  @Get('tree')
  @ACL({ roles: [1, 2, 3, 4, 5, 6] })
  async tree(
    @CurrentUser() me: Users,
    @Query('userId') userId?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromD = from ? new Date(from) : new Date('1970-01-01');
    const toD = to ? new Date(to) : new Date();
    return this.svc.getTree(me, userId, fromD, toD);
  }

 @Get('node-summary')
  @ACL({ roles: [1,2,3,4,5,6] })
  async nodeSummary(
    @CurrentUser() me: Users,
    @Query('userId') userIdStr?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = userIdStr ? Number(userIdStr) : undefined;
    const fromD = from ? new Date(from) : new Date('1970-01-01');
    const toD   = to   ? new Date(to)   : new Date();
    return this.svc.getNodeSummary(me, userId, fromD, toD);
  }

  @Get('dashboard')
  @ACL({ roles: [1,2,3,4,5,6] }) // ← اضافه شد
  async dashboard(
    @CurrentUser() me: Users,
    @Query('userId') userIdStr?: string, // ← حذف ParseIntPipe
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bucket', new DefaultValuePipe(Bucket.day), new ParseEnumPipe(Bucket))
    bucket: Bucket = Bucket.day,
  ) {
    const userId = userIdStr ? Number(userIdStr) : undefined;
    const fromD = from ? new Date(from) : new Date('1970-01-01');
    const toD   = to   ? new Date(to)   : new Date();
    return this.svc.getDashboard(me, userId, bucket, fromD, toD);
  }

}

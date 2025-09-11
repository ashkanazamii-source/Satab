// src/analytics/analytics.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserModule } from '../users/users.module';
import { AclModule } from '../acl/acl.module';
import { RolePermissionModule } from '../permissions/role-permission.module'; // 👈 این ماژول را وارد کنید


@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AclModule),
    forwardRef(() => RolePermissionModule),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService], // ✅✅ این خط را اضافه کن
})
export class AnalyticsModule {}
// src/acl/acl.module.ts
import { Module } from '@nestjs/common';
import { AclGuard } from './acl.guard';
import { RolePermissionModule } from '../permissions/role-permission.module';

@Module({
  imports: [RolePermissionModule],
  providers: [AclGuard],
  exports: [AclGuard], // فقط گارد رو صادر کن
})
export class AclModule {}

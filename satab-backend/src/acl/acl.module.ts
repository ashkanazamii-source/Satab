// src/acl/acl.module.ts
import { forwardRef, Module } from '@nestjs/common'; // 👈 forwardRef را اضافه کنید
import { AclGuard } from './acl.guard';
import { RolePermissionModule } from '../permissions/role-permission.module';

@Module({
  imports: [forwardRef(() => RolePermissionModule)], // ✅ مشکل حل شد
  providers: [AclGuard],
  exports: [AclGuard], // بهتر است فقط چیزی که واقعا نیاز است export شود (AclGuard)
})
export class AclModule { }
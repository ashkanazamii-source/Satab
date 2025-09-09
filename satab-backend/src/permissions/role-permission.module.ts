// src/role-permission/role-permission.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionController } from './role-permission.controller';
import { Users } from '../users/users.entity';
import { UserModule } from '../users/users.module';
import { VehiclePolicy } from '../vehicle-policies/vehicle-policy.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RolePermission, Users, VehiclePolicy]),
    forwardRef(() => UserModule),
  ],
  providers: [RolePermissionService],
  exports: [RolePermissionService], // ⬅️ لازم
  controllers: [RolePermissionController],
})
export class RolePermissionModule {}

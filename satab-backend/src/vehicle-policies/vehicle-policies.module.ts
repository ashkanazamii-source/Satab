// vehicle-policies.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclePoliciesService } from './vehicle-policies.service';
import { VehiclePoliciesController } from './vehicle-policies.controller';
import { VehiclePolicy } from './/vehicle-policy.entity';
import { Users } from '../users/users.entity';
import { RolePermissionModule } from '../permissions/role-permission.module';
import { AclModule } from '../acl/acl.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehiclePolicy, Users, VehiclePoliciesModule // ✅ اضافه کن
    ]), // اینجا Users رو اضافه کنید
    RolePermissionModule, AclModule,
  ],
  controllers: [VehiclePoliciesController],
  providers: [VehiclePoliciesService],
  exports: [VehiclePoliciesService],
  
})
export class VehiclePoliciesModule { }

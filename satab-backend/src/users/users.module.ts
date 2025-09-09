import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './users.entity';
import { UserService } from './users.service';
import { UserController } from './users.controller';
import { RolePermission } from '../permissions/role-permission.entity';
import { RolePermissionModule } from '../permissions/role-permission.module';
import { Device } from '../entities/device.entity';          // ✅ اضافه شد
import { Vehicle } from '../vehicles/vehicle.entity';   
@Module({
  imports: [
    TypeOrmModule.forFeature([Users, RolePermission, Device, Vehicle]),
    forwardRef(() => RolePermissionModule), // فقط اگر حلقه وابستگی داری
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

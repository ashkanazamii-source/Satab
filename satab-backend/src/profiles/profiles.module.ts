import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { VehicleSettingProfile } from './profiles.entity';
import { Users } from '../users/users.entity'; // مسیر درست entity کاربر

@Module({
  imports: [TypeOrmModule.forFeature([VehicleSettingProfile, Users])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // ✅ 1. این را import کنید
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { VehicleSettingProfile } from './profiles.entity'; // ✅ 2. انتیتی را import کنید

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleSettingProfile]) // ✅ 3. انتیتی را در اینجا ثبت کنید
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
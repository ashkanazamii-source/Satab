import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShiftProfilesService } from './shift-profiles.service';
import { ShiftProfilesController } from './shift-profiles.controller';

import { ShiftProfile } from './shift-profile.entity';
import { Shift } from '../shifts/shift.entity';

@Module({
  imports: [
    // حتماً هر دو Entity اینجا باشند:
    TypeOrmModule.forFeature([ShiftProfile, Shift]),
  ],
  controllers: [ShiftProfilesController],
  providers: [ShiftProfilesService],
  exports: [ShiftProfilesService], // اگر جای دیگه‌ای لازم داری
})
export class ShiftProfilesModule {}

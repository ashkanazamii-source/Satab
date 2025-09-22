// consumables.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consumable } from './consumable.entity';
import { ConsumablesService } from './consumables.service';
import { ConsumablesController } from './consumables.controller';
import { ConsumablesForSaController } from './consumables.controller'; // چون هر دو کلاس در همین فایل هستند
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([Consumable]), HttpModule],
  providers: [ConsumablesService],
  controllers: [ConsumablesController, ConsumablesForSaController],
})
export class ConsumablesModule { }

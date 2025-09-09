// consumables.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consumable } from './consumable.entity';
import { ConsumablesService } from './consumables.service';
import { ConsumablesController } from './consumables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Consumable])],
  providers: [ConsumablesService],
  controllers: [ConsumablesController],
})
export class ConsumablesModule {}

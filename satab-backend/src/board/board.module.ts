import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { BoardGateway } from './board.gateway';
import { ApiKeyGuard } from './guards/api-key.guard';
import { VehiclesGateway } from '../vehicles/vehicles.gateway';

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardGateway, ApiKeyGuard, VehiclesGateway],
  exports: [BoardGateway, BoardService],
})
export class BoardModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairingController } from './pairing.controller';
import { PairingService } from './pairing.service';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Users } from '../users/users.entity';

@Module({
  imports: [
    // لازم است تا @InjectDataSource و ریپوها در اسکوپ این ماژول باشند
    TypeOrmModule.forFeature([Vehicle, Users]),
  ],
  providers: [PairingService],
  controllers: [PairingController],
  exports: [PairingService],
})
export class PairingModule {}

// pairing/pairing.module.ts
import { Module } from '@nestjs/common';
import { PairingController } from './pairing.controller';
import { PairingService } from './pairing.service';

@Module({
  imports: [],
  providers: [PairingService],
  controllers: [PairingController],
  exports: [PairingService],
})
export class PairingModule {}

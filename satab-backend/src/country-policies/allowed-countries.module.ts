import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllowedCountry } from './allowed-country.entity';
import { AllowedCountriesService } from './allowed-countries.service';
import { AllowedCountriesController } from './allowed-countries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AllowedCountry])],
  providers: [AllowedCountriesService],
  controllers: [AllowedCountriesController],
  exports: [AllowedCountriesService],
})
export class AllowedCountriesModule {}

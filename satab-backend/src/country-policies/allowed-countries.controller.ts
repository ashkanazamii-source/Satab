import { Body, Controller, Get, Param, ParseIntPipe, Put, UsePipes, ValidationPipe } from '@nestjs/common';
import { AllowedCountriesService } from './allowed-countries.service';
import { UpdateAllowedCountriesDto } from '../dto/update-allowed-countries.dto';

// @UseGuards(JwtAuthGuard, AclGuard)
@Controller('country-policies')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AllowedCountriesController {
  constructor(private readonly service: AllowedCountriesService) {}

  @Get('user/:id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getForUser(id);
  }

  @Put('user/:id')
  set(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateAllowedCountriesDto) {
    return this.service.replaceForUser(id, body);
  }
}

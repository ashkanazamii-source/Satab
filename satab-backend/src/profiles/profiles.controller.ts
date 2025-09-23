import {
  Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request,
  ParseIntPipe, HttpCode, HttpStatus, Query
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('vehicle-setting-profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProfileDto: CreateProfileDto, @Request() req) {
    const userId = req.user.id;
    return this.profilesService.create(createProfileDto, userId);
  }

  /** 
   * GET /vehicle-setting-profiles?owner_user_id=123
   * اگر owner_user_id ندهی:
   *   - برای SA: پروفایل‌های خودش
   *   - برای نقش‌های پایین‌تر: پروفایل‌های SA بالادستی
   */
  @Get()
  findAll(
    @Request() req,
    @Query('owner_user_id') ownerUserId?: string,
  ) {
    const viewerId = req.user.id;
    const ownerId = ownerUserId ? Number(ownerUserId) : undefined;
    return this.profilesService.findAllVisible(viewerId, ownerId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.profilesService.update(id, updateProfileDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.profilesService.remove(id, userId);
  }
}

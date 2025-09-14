import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // مسیر گارد احراز هویت شما

/**
 * Controller to handle API requests for vehicle setting profiles.
 * All routes are protected and require user authentication.
 */
@UseGuards(JwtAuthGuard)
@Controller('vehicle-setting-profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * Creates a new vehicle setting profile for the authenticated user.
   * POST /vehicle-setting-profiles
   * @param createProfileDto - The data for the new profile.
   * @param req - The authenticated request object containing user info.
   * @returns The newly created profile.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProfileDto: CreateProfileDto, @Request() req) {
    // The user's ID is extracted from the request object, which is populated
    // by the JwtAuthGuard after successful token validation.
    const userId = req.user.id;
    return this.profilesService.create(createProfileDto, userId);
  }

  /**
   * Retrieves all profiles belonging to the authenticated user.
   * GET /vehicle-setting-profiles
   * @param req - The authenticated request object.
   * @returns A list of the user's profiles.
   */
  @Get()
  findAll(@Request() req) {
    const userId = req.user.id;
    return this.profilesService.findAll(userId);
  }

  /**
   * Updates an existing profile.
   * The service layer ensures that the user can only update their own profiles.
   * PUT /vehicle-setting-profiles/:id
   * @param id - The ID of the profile to update.
   * @param updateProfileDto - The data to update.
   * @param req - The authenticated request object.
   * @returns The updated profile.
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.profilesService.update(id, updateProfileDto, userId);
  }

  /**
   * Deletes a profile.
   * The service layer ensures that the user can only delete their own profiles.
   * DELETE /vehicle-setting-profiles/:id
   * @param id - The ID of the profile to delete.
   * @param req - The authenticated request object.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.profilesService.remove(id, userId);
  }
}

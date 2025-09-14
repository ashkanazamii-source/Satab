import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';

/**
 * Data Transfer Object for updating an existing vehicle setting profile.
 * It extends CreateProfileDto and makes all properties optional.
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
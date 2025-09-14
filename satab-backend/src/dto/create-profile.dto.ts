import { IsNotEmpty, IsObject, IsString, MinLength } from 'class-validator';

/**
 * Data Transfer Object for creating a new vehicle setting profile.
 */
export class CreateProfileDto {
  /**
   * The name of the profile.
   * @example "مسیر انبار مرکزی"
   */
  @IsString({ message: 'نام پروفایل باید یک رشته متنی باشد.' })
  @IsNotEmpty({ message: 'نام پروفایل نمی‌تواند خالی باشد.' })
  @MinLength(3, { message: 'نام پروفایل باید حداقل ۳ کاراکتر باشد.' })
  name: string;

  /**
   * The settings object containing stations, geofence, etc.
   * @example { "stations": [], "geofence": null }
   */
  @IsObject({ message: 'فیلد تنظیمات باید یک آبجکت باشد.' })
  @IsNotEmpty({ message: 'فیلد تنظیمات نمی‌تواند خالی باشد.' })
  settings: Record<string, any>;
}
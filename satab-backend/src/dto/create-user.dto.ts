import {
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateNested,
  IsBoolean,
  IsInt,
  IsArray,
  MinLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserLevel } from '../entities/role.entity';
import { SuperAdminType } from '../users/users.entity'; // ⬅️ اضافه شد

export class CreateUserPermissionDto {
  @IsEnum(UserLevel, { message: 'سطح نقش نامعتبر است.' })
  target_level: UserLevel;

  @IsString({ message: 'نام اکشن باید رشته باشد.' })
  action: string;

  @IsBoolean({ message: 'is_allowed باید مقدار بولین باشد.' })
  is_allowed: boolean;

  @IsOptional()
  @IsInt({ message: 'حداکثر دستگاه باید عدد صحیح باشد.' })
  max_devices?: number;

  @IsOptional()
  @IsInt({ message: 'حداکثر راننده باید عدد صحیح باشد.' })
  max_drivers?: number;
}
export class UpdateUserDto {
  @IsOptional() @IsString()
  full_name?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  password?: string;

  @IsOptional() @IsEnum(UserLevel)
  role_level?: UserLevel;

  // اگر نیاز شد از سمت منیجر/ادمین تغییر کند
  @IsOptional()
  @IsEnum(SuperAdminType, { message: 'نوع سوپرادمین نامعتبر است.' })
  sa_type?: SuperAdminType;

  // این فیلد مخصوص ست/حذف والد است
  @IsOptional()
  parent_id?: number | null;

  @IsOptional() @IsInt() @Min(0)
  max_devices?: number;

  @IsOptional() @IsInt() @Min(0)
  max_drivers?: number;
}

export class CreateUserDto {
  @IsString({ message: 'نام کامل الزامی است.' })
  @MinLength(2, { message: 'نام باید حداقل ۲ حرف باشد.' })
  full_name: string;

  @IsPhoneNumber('IR', { message: 'شماره موبایل معتبر نیست.' })
  phone: string;

  @IsString({ message: 'رمز عبور الزامی است.' })
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  password: string;

  @IsEnum(UserLevel, { message: 'سطح نقش نامعتبر است.' })
  role_level: UserLevel;

  // ــــــــــــــ sa_type:
  // هنگام ساخت سوپرادمین اجباری‌ست، در غیر این صورت نادیده گرفته می‌شود
  @ValidateIf(o => o.role_level === UserLevel.SUPER_ADMIN)
  @IsEnum(SuperAdminType, { message: 'نوع سوپرادمین نامعتبر است. (fleet/device/universal)' })
  sa_type?: SuperAdminType;

  // ============== روابط بالادستی ممکن ==============
  @IsOptional()
  @IsInt({ message: 'manager_id باید عدد صحیح باشد.' })
  manager_id?: number;

  @IsOptional()
  @IsInt({ message: 'super_admin_id باید عدد صحیح باشد.' })
  super_admin_id?: number;

  @IsOptional()
  @IsInt({ message: 'owner_id باید عدد صحیح باشد.' })
  owner_id?: number;

  @IsOptional()
  @IsInt({ message: 'branch_manager_id باید عدد صحیح باشد.' })
  branch_manager_id?: number;

  // ============== محدودیت‌ها ==============
  @IsOptional()
  @IsInt({ message: 'حداکثر دستگاه باید عدد صحیح باشد.' })
  max_devices?: number;

  @IsOptional()
  @IsInt({ message: 'parent_id باید عدد صحیح باشد.' })
  parent_id?: number;

  @IsOptional()
  @IsInt({ message: 'حداکثر راننده باید عدد صحیح باشد.' })
  max_drivers?: number;

  // ============== مجوزها فقط برای سوپرادمین‌ها ==============
  @IsOptional()
  @IsArray({ message: 'permissions باید آرایه‌ای از مجوزها باشد.' })
  @ValidateNested({ each: true })
  @Type(() => CreateUserPermissionDto)
  permissions?: CreateUserPermissionDto[];
}


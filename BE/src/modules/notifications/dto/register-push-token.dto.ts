import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterPushTokenDto {
  @IsString()
  expoPushToken: string; // FCM device token (field name kept for API compat)

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: 'android' | 'ios';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

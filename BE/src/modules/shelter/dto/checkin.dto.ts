import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckinDto {
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  lng: number;
}

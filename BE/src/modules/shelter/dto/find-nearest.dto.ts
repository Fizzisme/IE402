import { IsLatitude, IsLongitude, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindNearestDto {
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  lng: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 5;
}

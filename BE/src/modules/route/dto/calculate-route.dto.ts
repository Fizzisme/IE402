import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CalculateRouteDto {
  @IsNotEmpty()
  @IsNumber()
  @IsLatitude()
  start_lat: number;

  @IsNotEmpty()
  @IsNumber()
  @IsLongitude()
  start_lng: number;

  @IsOptional()
  @IsString()
  shelter_id?: string;
}

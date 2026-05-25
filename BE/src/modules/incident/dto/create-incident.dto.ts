import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsNumber()
  @IsLatitude()
  lat: number;

  @IsNotEmpty()
  @IsNumber()
  @IsLongitude()
  lng: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['blocked_road', 'flood_point', 'fire_point', 'debris', 'other'])
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  severity?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  affected_radius_m?: number;

  @IsOptional()
  @IsString()
  image_url?: string;
}

import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCircleDangerZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(50)
  @Max(50000)
  radius_meters: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  danger_level: number;

  @IsNotEmpty()
  @IsString()
  @IsIn([
    'air_raid_alert',
    'airstrike',
    'armed_conflict',
    'flood',
    'fire',
    'landslide',
    'shelling',
    'other',
  ])
  event_type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['acled', 'ucdp', 'manual'])
  data_source?: string;

  @IsOptional()
  valid_from?: string;

  @IsOptional()
  valid_until?: string;
}

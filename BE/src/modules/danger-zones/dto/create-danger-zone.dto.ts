import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDangerZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsArray()
  coordinates: number[][];

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  danger_level: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['armed_conflict', 'flood', 'fire', 'landslide', 'other'])
  event_type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['acled', 'ucdp', 'manual'])
  data_source?: string;

  @IsOptional()
  @IsString()
  source_event_id?: string;

  @IsOptional()
  valid_from?: string;

  @IsOptional()
  valid_until?: string;
}

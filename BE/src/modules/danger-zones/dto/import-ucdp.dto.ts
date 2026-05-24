import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class UcdpEventDto {
  @IsNumber()
  id: number; // UCDP event ID

  @IsNumber()
  year: number;

  @IsString()
  date_start: string; // format: "YYYY-MM-DD"

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  @IsOptional()
  // 1 = state-based conflict, 2 = non-state conflict, 3 = one-sided violence
  type_of_violence?: number;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  conflict_name?: string;

  @IsNumber()
  @IsOptional()
  deaths_civilians?: number;

  @IsString()
  @IsOptional()
  side_a?: string;

  @IsString()
  @IsOptional()
  side_b?: string;
}

export class ImportUcdpDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UcdpEventDto)
  events: UcdpEventDto[];
}

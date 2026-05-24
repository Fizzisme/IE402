import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AcledEventDto {
  @IsString()
  event_id_cnty: string;

  @IsString()
  event_date: string; // format: "YYYY-MM-DD"

  @IsString()
  event_type: string; // "Battles" | "Explosions/Remote violence" | ...

  @IsString()
  @IsOptional()
  sub_event_type?: string; // "Air/drone strike" | "Shelling/artillery/missile attack" | ...

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @IsOptional()
  fatalities?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ImportAcledDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcledEventDto)
  events: AcledEventDto[];
}

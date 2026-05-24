import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateShelterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @IsLatitude()
  lat: number;

  @IsNotEmpty()
  @IsNumber()
  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  capacity: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsBoolean()
  has_medical?: boolean;

  @IsOptional()
  @IsBoolean()
  has_food?: boolean;

  @IsOptional()
  @IsBoolean()
  has_water?: boolean;

  @IsOptional()
  @IsString()
  image_url?: string;
}

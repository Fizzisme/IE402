import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ClusterZonesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  eps?: number = 0.01; // ~1.1km in degrees

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  min_points?: number = 3;

  // Gom cả manual zones vào clustering (hữu ích khi 2 zone thủ công sát nhau)
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_manual?: boolean = false;
}

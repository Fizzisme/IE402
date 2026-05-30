import { IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SimulateAirstrikeDto {
  // Đường bay: mảng các điểm [lng, lat], tối thiểu 2 điểm
  @IsArray()
  flightPath: number[][];

  // Số điểm thả bom dự đoán muốn sinh ra
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

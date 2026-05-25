import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['available', 'full', 'closed'])
  status: string;
}

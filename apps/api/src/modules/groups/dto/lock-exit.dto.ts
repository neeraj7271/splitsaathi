import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LockExitDto {
  @ApiProperty({ required: false, example: 'Member moved out with an unsettled balance.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

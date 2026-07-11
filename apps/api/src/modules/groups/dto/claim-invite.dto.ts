import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimInviteDto {
  @ApiProperty({ required: false, example: 'Ananya' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

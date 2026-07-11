import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({ required: false, default: 14, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays = 14;

  @ApiProperty({ required: false, nullable: true, minimum: 1, maximum: 250 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(250)
  maxUses?: number;
}

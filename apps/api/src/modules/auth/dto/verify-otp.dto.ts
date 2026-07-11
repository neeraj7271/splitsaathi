import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ required: false, example: 'Priya Shah' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}

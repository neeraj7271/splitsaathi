import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class StartOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @IsPhoneNumber()
  phoneE164!: string;
}

export class StartOtpResponseDto {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  @ApiProperty({ example: '+91***10' })
  maskedDestination!: string;

  @ApiProperty({ example: 'development' })
  deliveryMode!: string;

  @ApiProperty({ example: '2026-07-10T16:30:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ required: false, example: '123456' })
  devCode?: string;
}

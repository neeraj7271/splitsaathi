import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

/** Phone sign-in / link without OTP (OTP delivery not enabled in current deploy). */
export class PhoneAuthDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @IsPhoneNumber()
  phoneE164!: string;

  @ApiPropertyOptional({ example: 'Rahul' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}

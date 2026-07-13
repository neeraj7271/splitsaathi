import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class StartEmailSignupDto {
  @ApiProperty({ example: 'priya@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Priya Shah' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}

export class VerifyEmailSignupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class EmailPasswordLoginDto {
  @ApiProperty({ example: 'priya@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class StartPasswordResetDto {
  @ApiProperty({ example: 'priya@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class StartEmailOtpResponseDto {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  @ApiProperty({ example: 'development' })
  deliveryMode!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  resendAvailableAt!: string;

  @ApiPropertyOptional({ example: '123456' })
  devCode?: string;
}

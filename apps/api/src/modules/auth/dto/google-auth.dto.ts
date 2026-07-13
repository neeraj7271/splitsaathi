import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OpenID Connect ID token obtained by the mobile app.' })
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  idToken!: string;
}

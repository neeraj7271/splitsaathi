import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Optional refresh token to revoke when session id is unavailable.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

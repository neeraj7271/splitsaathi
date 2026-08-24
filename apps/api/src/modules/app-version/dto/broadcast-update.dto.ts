import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BroadcastUpdateDto {
  @ApiPropertyOptional({ example: '1.0.1', description: 'Version name of the new release' })
  @IsOptional()
  @IsString()
  versionName?: string;

  @ApiPropertyOptional({ example: 'Bug fixes and performance improvements!', description: 'Release notes for users' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;
}

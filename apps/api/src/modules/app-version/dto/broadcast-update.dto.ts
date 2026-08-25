import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class BroadcastUpdateDto {
  @ApiPropertyOptional({ example: '1.0.1', description: 'Version name of the new release' })
  @IsOptional()
  @IsString()
  versionName?: string;

  @ApiPropertyOptional({ example: 100010, description: 'Version code integer (e.g. 100010 for v1.0.1)' })
  @IsOptional()
  @IsNumber()
  versionCode?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Minimum supported version code for forced update' })
  @IsOptional()
  @IsNumber()
  minSupportedVersionCode?: number;

  @ApiPropertyOptional({ example: false, description: 'Whether to force all users to update' })
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional({ example: 'Bug fixes and performance improvements!', description: 'Release notes for users' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertFeatureFlagDto {
  @ApiProperty({ example: 'enable_new_settlement_ui', description: 'Feature flag unique key' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'Enables redesigned UPI settlement flow', description: 'Description of the feature flag' })
  @IsString()
  description!: string;

  @ApiProperty({ example: true, description: 'Whether the feature flag is enabled' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ example: 100, description: 'Rollout percentage (0 to 100)' })
  @IsOptional()
  @IsNumber()
  rolloutPercentage?: number;

  @ApiPropertyOptional({ example: ['android', 'ios'], description: 'Target platforms' })
  @IsOptional()
  @IsArray()
  targetPlatforms?: string[];

  @ApiPropertyOptional({ example: '1.0.0', description: 'Minimum app version requirement' })
  @IsOptional()
  @IsString()
  minAppVersion?: string;
}

export class UpdateAppConfigDto {
  @ApiProperty({ example: 'android', description: 'Platform identifier (android/ios)' })
  @IsString()
  platform!: string;

  @ApiProperty({ example: '1.0.0', description: 'Minimum supported app version' })
  @IsString()
  minSupportedVersion!: string;

  @ApiProperty({ example: '1.0.1', description: 'Latest released app version' })
  @IsString()
  latestVersion!: string;

  @ApiProperty({ example: false, description: 'Force update flag' })
  @IsBoolean()
  forceUpdateEnabled!: boolean;

  @ApiPropertyOptional({ example: 'Added new expense split features', description: 'Release notes / changelog' })
  @IsOptional()
  @IsString()
  changelog?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';
import type { UserAppearancePreference } from '../entities/user-preferences.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Priya Shah', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  avatarAttachmentId?: string | null;

  @ApiPropertyOptional({ example: 'priya@okaxis', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  upiVpa?: string | null;
}

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  biometricAuthEnabled?: boolean;

  @ApiPropertyOptional({ enum: [0, 5, 30, 60, 300, 600] })
  @IsOptional()
  @IsInt()
  @IsIn([0, 5, 30, 60, 300, 600])
  sessionTimeoutSeconds?: number;

  @ApiPropertyOptional({ enum: ['system', 'light', 'dark'] })
  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  appearance?: UserAppearancePreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailGroupAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailFriendAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailExpenseAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailExpenseEdited?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailExpenseComment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailExpenseDue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailPaymentReceived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailMonthlySummary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNewsUpdates?: boolean;
}

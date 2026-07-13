import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserEntity } from '../entities/user.entity';
import { UserPreferencesEntity } from '../entities/user-preferences.entity';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Priya Shah' })
  displayName!: string;

  @ApiProperty({ example: 'INR' })
  defaultCurrencyCode!: string;

  @ApiProperty({ example: 'active' })
  state!: string;

  @ApiPropertyOptional({ example: '+91 •••• 8829' })
  phoneMasked?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  avatarAttachmentId?: string | null;

  @ApiPropertyOptional({ example: '/v1/public/avatars/{id}' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'priya@okaxis' })
  upiVpa?: string | null;

  static fromEntity(entity: UserEntity, extras?: { phoneMasked?: string }): UserResponseDto {
    return {
      id: entity.id,
      displayName: entity.displayName,
      defaultCurrencyCode: entity.defaultCurrencyCode,
      state: entity.state,
      phoneMasked: extras?.phoneMasked,
      avatarAttachmentId: entity.avatarAttachmentId ?? null,
      avatarUrl: entity.avatarAttachmentId ? `/v1/public/avatars/${entity.avatarAttachmentId}` : null,
      upiVpa: entity.upiVpa ?? null
    };
  }
}

export class UserPreferencesResponseDto {
  @ApiProperty()
  biometricAuthEnabled!: boolean;

  @ApiProperty()
  sessionTimeoutSeconds!: number;

  @ApiProperty({ enum: ['system', 'light', 'dark'] })
  appearance!: string;

  @ApiProperty()
  pushNotificationsEnabled!: boolean;

  @ApiProperty()
  emailGroupAdded!: boolean;

  @ApiProperty()
  emailFriendAdded!: boolean;

  @ApiProperty()
  emailExpenseAdded!: boolean;

  @ApiProperty()
  emailExpenseEdited!: boolean;

  @ApiProperty()
  emailExpenseComment!: boolean;

  @ApiProperty()
  emailExpenseDue!: boolean;

  @ApiProperty()
  emailPaymentReceived!: boolean;

  @ApiProperty()
  emailMonthlySummary!: boolean;

  @ApiProperty()
  emailNewsUpdates!: boolean;

  static fromEntity(entity: UserPreferencesEntity): UserPreferencesResponseDto {
    return {
      biometricAuthEnabled: entity.biometricAuthEnabled,
      sessionTimeoutSeconds: entity.sessionTimeoutSeconds,
      appearance: entity.appearance,
      pushNotificationsEnabled: entity.pushNotificationsEnabled,
      emailGroupAdded: entity.emailGroupAdded,
      emailFriendAdded: entity.emailFriendAdded,
      emailExpenseAdded: entity.emailExpenseAdded,
      emailExpenseEdited: entity.emailExpenseEdited,
      emailExpenseComment: entity.emailExpenseComment,
      emailExpenseDue: entity.emailExpenseDue,
      emailPaymentReceived: entity.emailPaymentReceived,
      emailMonthlySummary: entity.emailMonthlySummary,
      emailNewsUpdates: entity.emailNewsUpdates
    };
  }
}

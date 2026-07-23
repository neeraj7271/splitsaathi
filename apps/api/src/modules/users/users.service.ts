import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttachmentEntity } from '@splitsaathi/db';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { UserPreferencesEntity } from './entities/user-preferences.entity';
import { UserEntity } from './entities/user.entity';
import { UpdateUserPreferencesDto } from './dto/update-user.dto';
import { UserPreferencesResponseDto } from './dto/user-response.dto';

interface CreateUserInput {
  displayName: string;
  defaultCurrencyCode?: string;
}

interface UpdateUserInput {
  displayName?: string;
  avatarAttachmentId?: string | null;
  upiVpa?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserPreferencesEntity)
    private readonly preferences: Repository<UserPreferencesEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AttachmentEntity)
    private readonly attachments: Repository<AttachmentEntity>
  ) {}

  async createUser(input: CreateUserInput): Promise<UserEntity> {
    const user = this.users.create({
      displayName: input.displayName,
      defaultCurrencyCode: input.defaultCurrencyCode ?? 'INR',
      state: 'active',
      avatarAttachmentId: null,
      upiVpa: null
    });
    return this.users.save(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async getPhoneMaskedForUser(userId: string): Promise<string | undefined> {
    const phoneE164 = await this.getPhoneE164ForUser(userId);
    return phoneE164 ? maskPhoneE164(phoneE164) : undefined;
  }

  async getPhoneE164ForUser(userId: string): Promise<string | null> {
    const identity = await this.identities.findOne({ where: { userId, provider: 'phone' } });
    return identity?.identifier ?? null;
  }

  async getEmailForUser(userId: string): Promise<string | null> {
    const emailIdentity = await this.identities.findOne({ where: { userId, provider: 'email' } });
    if (emailIdentity?.identifier) {
      return emailIdentity.identifier;
    }
    return null;
  }

  async updateUser(user: UserEntity, input: UpdateUserInput): Promise<UserEntity> {
    if (input.displayName !== undefined) {
      user.displayName = input.displayName;
    }
    if (input.avatarAttachmentId !== undefined) {
      if (input.avatarAttachmentId) {
        await this.assertAvatarAttachment(user.id, input.avatarAttachmentId);
      }
      user.avatarAttachmentId = input.avatarAttachmentId;
    }
    if (input.upiVpa !== undefined) {
      user.upiVpa = input.upiVpa?.trim() || null;
    }
    return this.users.save(user);
  }

  async updateDisplayName(user: UserEntity, displayName: string): Promise<UserEntity> {
    return this.updateUser(user, { displayName });
  }

  async getPreferencesForUser(userId: string): Promise<UserPreferencesEntity> {
    const existing = await this.preferences.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const created = this.preferences.create({ userId });
    return this.preferences.save(created);
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferencesEntity> {
    const preferences = await this.getPreferencesForUser(userId);
    Object.assign(preferences, compactPreferencesPatch(dto));
    return this.preferences.save(preferences);
  }

  toPreferencesDto(entity: UserPreferencesEntity): UserPreferencesResponseDto {
    return UserPreferencesResponseDto.fromEntity(entity);
  }

  private async assertAvatarAttachment(userId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachments.findOne({ where: { id: attachmentId } });
    if (!attachment || attachment.ownerUserId !== userId || attachment.purpose !== 'avatar') {
      throw new BadRequestException('Avatar attachment is invalid.');
    }
  }
}

function compactPreferencesPatch(dto: UpdateUserPreferencesDto): Partial<UserPreferencesEntity> {
  const patch: Partial<UserPreferencesEntity> = {};
  if (dto.biometricAuthEnabled !== undefined) patch.biometricAuthEnabled = dto.biometricAuthEnabled;
  if (dto.sessionTimeoutSeconds !== undefined) patch.sessionTimeoutSeconds = dto.sessionTimeoutSeconds;
  if (dto.appearance !== undefined) patch.appearance = dto.appearance;
  if (dto.pushNotificationsEnabled !== undefined) patch.pushNotificationsEnabled = dto.pushNotificationsEnabled;
  if (dto.emailGroupAdded !== undefined) patch.emailGroupAdded = dto.emailGroupAdded;
  if (dto.emailFriendAdded !== undefined) patch.emailFriendAdded = dto.emailFriendAdded;
  if (dto.emailExpenseAdded !== undefined) patch.emailExpenseAdded = dto.emailExpenseAdded;
  if (dto.emailExpenseEdited !== undefined) patch.emailExpenseEdited = dto.emailExpenseEdited;
  if (dto.emailExpenseComment !== undefined) patch.emailExpenseComment = dto.emailExpenseComment;
  if (dto.emailExpenseDue !== undefined) patch.emailExpenseDue = dto.emailExpenseDue;
  if (dto.emailPaymentReceived !== undefined) patch.emailPaymentReceived = dto.emailPaymentReceived;
  if (dto.emailMonthlySummary !== undefined) patch.emailMonthlySummary = dto.emailMonthlySummary;
  if (dto.emailNewsUpdates !== undefined) patch.emailNewsUpdates = dto.emailNewsUpdates;
  if (Object.keys(patch).length === 0) {
    throw new BadRequestException('At least one preference field must be provided.');
  }
  return patch;
}

function maskPhoneE164(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length <= 4) {
    return phoneE164;
  }
  const country = phoneE164.startsWith('+') ? phoneE164.slice(0, phoneE164.length - digits.length) + digits.slice(0, Math.min(2, digits.length - 4)) : '';
  const prefix = country || `+${digits.slice(0, 2)}`;
  const suffix = digits.slice(-4);
  return `${prefix} •••• ${suffix}`;
}

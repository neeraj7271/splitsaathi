import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type {
  AuthProvider,
  ConsentPurpose,
  ConsentSource,
  ConsentStatus,
  ContactAliasSource,
  DevicePlatform,
  JsonObject,
  OtpPurpose,
  UserStatus
} from './types';

@Entity({ name: 'users' })
@Index('uq_users_phone_hash', ['phoneHash'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_e164', type: 'text', nullable: true, comment: 'Encrypted E.164 phone number.' })
  phoneE164!: string | null;

  @Column({ name: 'phone_hash', type: 'text', nullable: true })
  phoneHash!: string | null;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ name: 'avatar_attachment_id', type: 'uuid', nullable: true })
  avatarAttachmentId!: string | null;

  @Column({ name: 'default_currency_code', type: 'char', length: 3, default: 'INR' })
  defaultCurrencyCode!: string;

  @Column({ type: 'text', default: 'en-IN' })
  locale!: string;

  @Column({ type: 'text' })
  status!: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'auth_identities' })
@Index('uq_auth_identities_provider_subject', ['provider', 'providerSubject'], { unique: true })
@Index('idx_auth_identities_user_id', ['userId'])
export class AuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  provider!: AuthProvider;

  @Column({ name: 'provider_subject', type: 'text' })
  providerSubject!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'otp_challenges' })
@Index('idx_otp_challenges_phone_hash_expires_at', ['phoneHash', 'expiresAt'])
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_hash', type: 'text' })
  phoneHash!: string;

  @Column({ name: 'otp_hash', type: 'text' })
  otpHash!: string;

  @Column({ type: 'text' })
  purpose!: OtpPurpose;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;
}

@Entity({ name: 'refresh_sessions' })
@Index('idx_refresh_sessions_user_id', ['userId'])
@Index('idx_refresh_sessions_device_id', ['deviceId'])
export class RefreshSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ name: 'refresh_token_hash', type: 'text' })
  refreshTokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'device_installations' })
@Index('idx_device_installations_user_id', ['userId'])
@Index('idx_device_installations_push_token', ['pushToken'])
export class DeviceInstallationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  platform!: DevicePlatform;

  @Column({ name: 'app_version', type: 'text' })
  appVersion!: string;

  @Column({ name: 'push_token', type: 'text', nullable: true })
  pushToken!: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;
}

@Entity({ name: 'consent_records' })
@Index('idx_consent_records_user_purpose', ['userId', 'purpose'])
export class ConsentRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  purpose!: ConsentPurpose;

  @Column({ type: 'text' })
  status!: ConsentStatus;

  @Column({ type: 'text' })
  source!: ConsentSource;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: JsonObject;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: true })
  grantedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}

@Entity({ name: 'contact_aliases' })
@Index('uq_contact_aliases_owner_phone', ['ownerUserId', 'phoneHash'], { unique: true })
export class ContactAliasEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'phone_hash', type: 'text' })
  phoneHash!: string;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName!: string | null;

  @Column({ type: 'text' })
  source!: ContactAliasSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

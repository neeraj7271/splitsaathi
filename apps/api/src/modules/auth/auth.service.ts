import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes, randomInt } from 'crypto';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ApiConfigService } from '../../config/api-config.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserEntity } from '../users/entities/user.entity';
import { ConsentsService } from '../consents/consents.service';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  EMAIL_OTP_CHALLENGE_TTL_MINUTES,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_PROVIDER,
  OTP_CHALLENGE_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_PROVIDER,
  OTP_START_COOLDOWN_SECONDS,
  REFRESH_TOKEN_TTL_DAYS
} from './auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  EmailPasswordLoginDto,
  ResetPasswordDto,
  StartEmailOtpResponseDto,
  StartEmailSignupDto,
  StartPasswordResetDto,
  VerifyEmailSignupDto
} from './dto/email-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { StartOtpDto, StartOtpResponseDto } from './dto/start-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { EmailCredentialEntity } from './entities/email-credential.entity';
import { EmailOtpChallengeEntity, EmailOtpPurpose } from './entities/email-otp-challenge.entity';
import { OtpChallengeEntity } from './entities/otp-challenge.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { OtpProviderPort } from './ports/otp-provider.port';
import { EmailProviderPort } from './ports/email-provider.port';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(OtpChallengeEntity)
    private readonly challenges: Repository<OtpChallengeEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessions: Repository<RefreshSessionEntity>,
    @InjectRepository(EmailCredentialEntity)
    private readonly emailCredentials: Repository<EmailCredentialEntity>,
    @InjectRepository(EmailOtpChallengeEntity)
    private readonly emailChallenges: Repository<EmailOtpChallengeEntity>,
    @Inject(OTP_PROVIDER)
    private readonly otpProvider: OtpProviderPort,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProviderPort,
    private readonly usersService: UsersService,
    private readonly consentsService: ConsentsService,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService
  ) {}

  async startOtp(dto: StartOtpDto): Promise<StartOtpResponseDto> {
    const phoneE164 = normalizePhoneE164(dto.phoneE164);
    const cooldownSince = new Date(Date.now() - OTP_START_COOLDOWN_SECONDS * 1000);
    const latest = await this.challenges.findOne({
      where: { phoneE164 },
      order: { createdAt: 'DESC' }
    });
    if (latest && latest.createdAt.getTime() > cooldownSince.getTime()) {
      const retryAfterSeconds = Math.ceil(
        (latest.createdAt.getTime() + OTP_START_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      );
      throw new HttpException(
        `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const expiresAt = new Date(Date.now() + OTP_CHALLENGE_TTL_MINUTES * 60 * 1000);
    const challenge = this.challenges.create({
      phoneE164,
      providerChallengeId: '',
      purpose: 'login',
      status: 'pending',
      attempts: 0,
      expiresAt,
      verifiedAt: null
    });

    const saved = await this.challenges.save(challenge);
    const delivery = await this.otpProvider.start({
      challengeId: saved.id,
      phoneE164,
      expiresAt,
      purpose: 'login'
    });
    saved.providerChallengeId = delivery.providerChallengeId;
    await this.challenges.save(saved);

    return {
      challengeId: saved.id,
      maskedDestination: delivery.maskedDestination,
      deliveryMode: delivery.deliveryMode,
      expiresAt: saved.expiresAt.toISOString(),
      devCode: delivery.devCode
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const challenge = await this.verifyPhoneOtpChallenge(dto.challengeId, dto.code);
    const user = await this.findOrCreateUserForPhone(challenge.phoneE164, dto.displayName);
    return this.issueAuthResponse(user, undefined, await this.needsOnboarding(user.id));
  }

  /**
   * Link a verified phone to an already-authenticated user (e.g. Google sign-in).
   * Call `startOtp` first to send the code; this verifies it without creating a new user.
   */
  async linkPhoneVerify(userId: string, dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const challenge = await this.verifyPhoneOtpChallenge(dto.challengeId, dto.code);
    return this.attachPhoneToUser(userId, challenge.phoneE164, dto.displayName);
  }

  /** Sign in / create account with phone only (no OTP) — used while SMS OTP is not enabled. */
  async loginWithPhone(dto: { phoneE164: string; displayName?: string }): Promise<AuthResponseDto> {
    const user = await this.findOrCreateUserForPhone(dto.phoneE164, dto.displayName);
    return this.issueAuthResponse(user, undefined, await this.needsOnboarding(user.id));
  }

  /** Link phone to the current user without OTP. */
  async linkPhone(userId: string, dto: { phoneE164: string; displayName?: string }): Promise<AuthResponseDto> {
    return this.attachPhoneToUser(userId, dto.phoneE164, dto.displayName);
  }

  private async attachPhoneToUser(userId: string, phoneRaw: string, displayName?: string): Promise<AuthResponseDto> {
    const normalized = normalizePhoneE164(phoneRaw);
    const candidates = phoneLookupCandidates(normalized);

    const existingForPhone = await this.identities.findOne({
      where: {
        provider: 'phone',
        identifier: In(candidates)
      }
    });
    if (existingForPhone && existingForPhone.userId !== userId) {
      throw new ConflictException('This phone number is already linked to another account.');
    }

    const existingForUser = await this.identities.findOne({ where: { userId, provider: 'phone' } });
    if (existingForUser) {
      const samePhone = candidates.includes(existingForUser.identifier);
      if (!samePhone) {
        throw new ConflictException('This account already has a different phone number linked.');
      }
      existingForUser.identifier = normalized;
      existingForUser.verifiedAt = new Date();
      await this.identities.save(existingForUser);
    } else if (existingForPhone) {
      existingForPhone.identifier = normalized;
      existingForPhone.verifiedAt = new Date();
      await this.identities.save(existingForPhone);
    } else {
      await this.identities.save(
        this.identities.create({
          userId,
          provider: 'phone',
          identifier: normalized,
          verifiedAt: new Date()
        })
      );
    }

    const user = await this.usersService.findByIdOrThrow(userId);
    if (displayName && user.displayName !== displayName) {
      return this.issueAuthResponse(
        await this.usersService.updateDisplayName(user, displayName),
        undefined,
        await this.needsOnboarding(userId)
      );
    }
    return this.issueAuthResponse(user, undefined, await this.needsOnboarding(userId));
  }

  async loginWithGoogle(idToken: string): Promise<AuthResponseDto> {
    const clientId = this.config.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      throw new HttpException('Google sign-in is not configured.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google did not return a verified email address.');
    }

    let identity = await this.identities.findOne({ where: { provider: 'google', identifier: payload.sub } });
    let user: UserEntity;
    if (identity) {
      user = await this.usersService.findByIdOrThrow(identity.userId);
    } else {
      const email = payload.email.trim().toLowerCase();
      const existingCredential = await this.emailCredentials.findOne({ where: { email } });
      user = existingCredential
        ? await this.usersService.findByIdOrThrow(existingCredential.userId)
        : await this.usersService.createUser({
            displayName: payload.name?.trim() || email.split('@')[0],
            defaultCurrencyCode: 'INR'
          });
      identity = await this.identities.save(
        this.identities.create({
          userId: user.id,
          provider: 'google',
          identifier: payload.sub,
          verifiedAt: new Date()
        })
      );
    }

    if (payload.name?.trim() && user.displayName.startsWith('User ')) {
      user = await this.usersService.updateDisplayName(user, payload.name.trim());
    }
    return this.issueAuthResponse(user, 'Google', await this.needsOnboarding(user.id));
  }

  async startEmailSignup(dto: StartEmailSignupDto): Promise<StartEmailOtpResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.emailCredentials.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account already exists for this email.');
    }
    return this.startEmailChallenge(email, 'signup', {
      passwordHash: await bcrypt.hash(dto.password, 12),
      displayName: dto.displayName?.trim() || null
    });
  }

  async verifyEmailSignup(dto: VerifyEmailSignupDto): Promise<AuthResponseDto> {
    const challenge = await this.verifyEmailChallenge(dto.challengeId, dto.code, 'signup');
    if (!challenge.passwordHash) {
      throw new UnauthorizedException('Email signup challenge is not valid.');
    }
    const existing = await this.emailCredentials.findOne({ where: { email: challenge.email } });
    if (existing) {
      throw new ConflictException('An account already exists for this email.');
    }

    const user = await this.usersService.createUser({
      displayName: challenge.displayName || this.defaultDisplayNameForEmail(challenge.email),
      defaultCurrencyCode: 'INR'
    });
    await this.emailCredentials.save(
      this.emailCredentials.create({
        email: challenge.email,
        userId: user.id,
        passwordHash: challenge.passwordHash,
        verifiedAt: new Date()
      })
    );
    return this.issueAuthResponse(user, undefined, await this.needsOnboarding(user.id));
  }

  async loginWithEmailPassword(dto: EmailPasswordLoginDto): Promise<AuthResponseDto> {
    const credential = await this.emailCredentials.findOne({ where: { email: this.normalizeEmail(dto.email) } });
    if (!credential || !credential.verifiedAt || !(await bcrypt.compare(dto.password, credential.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    const user = await this.usersService.findByIdOrThrow(credential.userId);
    return this.issueAuthResponse(user, undefined, false);
  }

  async startPasswordReset(dto: StartPasswordResetDto): Promise<StartEmailOtpResponseDto> {
    return this.startEmailChallenge(this.normalizeEmail(dto.email), 'password_reset');
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const challenge = await this.verifyEmailChallenge(dto.challengeId, dto.code, 'password_reset');
    const credential = await this.emailCredentials.findOne({ where: { email: challenge.email } });
    if (!credential || !credential.verifiedAt) {
      throw new UnauthorizedException('Password reset challenge is not valid.');
    }
    credential.passwordHash = await bcrypt.hash(dto.password, 12);
    await this.emailCredentials.save(credential);
    const sessions = await this.refreshSessions.find({ where: { userId: credential.userId } });
    const now = new Date();
    await this.refreshSessions.save(sessions.map((session) => ({ ...session, revokedAt: now })));
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(dto.refreshToken);
    const session = await this.refreshSessions.findOne({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token is not valid.');
    }

    session.revokedAt = new Date();
    await this.refreshSessions.save(session);

    const user = await this.usersService.findByIdOrThrow(session.userId);
    return this.issueAuthResponse(user, session.deviceLabel ?? undefined, false);
  }

  async logout(input: { sessionId?: string; refreshToken?: string }): Promise<void> {
    if (input.sessionId) {
      const session = await this.refreshSessions.findOne({ where: { id: input.sessionId } });
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.refreshSessions.save(session);
      }
      return;
    }

    if (input.refreshToken) {
      const tokenHash = this.hashToken(input.refreshToken);
      const session = await this.refreshSessions.findOne({ where: { tokenHash } });
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.refreshSessions.save(session);
      }
    }
  }

  private async findOrCreateUserForPhone(phoneE164: string, displayName?: string): Promise<UserEntity> {
    const normalized = normalizePhoneE164(phoneE164);
    const candidates = phoneLookupCandidates(normalized);
    const identity = await this.identities.findOne({
      where: {
        provider: 'phone',
        identifier: In(candidates)
      }
    });

    if (identity) {
      // Canonicalize stored identifier if an older format was used.
      if (identity.identifier !== normalized) {
        identity.identifier = normalized;
        identity.verifiedAt = new Date();
        await this.identities.save(identity);
      }
      const user = await this.usersService.findByIdOrThrow(identity.userId);
      if (displayName && user.displayName !== displayName) {
        return this.usersService.updateDisplayName(user, displayName);
      }
      return user;
    }

    const user = await this.usersService.createUser({
      displayName: displayName ?? this.defaultDisplayName(normalized),
      defaultCurrencyCode: 'INR'
    });
    await this.identities.save(
      this.identities.create({
        userId: user.id,
        provider: 'phone',
        identifier: normalized,
        verifiedAt: new Date()
      })
    );
    return user;
  }

  private async startEmailChallenge(
    email: string,
    purpose: EmailOtpPurpose,
    metadata: { passwordHash?: string; displayName?: string | null } = {}
  ): Promise<StartEmailOtpResponseDto> {
    const latest = await this.emailChallenges.findOne({
      where: { email, purpose },
      order: { createdAt: 'DESC' }
    });
    if (latest?.status === 'pending' && latest.resendAvailableAt.getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((latest.resendAvailableAt.getTime() - Date.now()) / 1000);
      throw new HttpException(`Please wait ${retryAfterSeconds} seconds before requesting another code.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const code =
      this.config.env.EMAIL_PROVIDER_DRIVER === 'dev'
        ? this.config.env.EMAIL_DEV_CODE
        : this.generateEmailOtpCode();
    const expiresAt = new Date(Date.now() + EMAIL_OTP_CHALLENGE_TTL_MINUTES * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000);
    const challenge = await this.emailChallenges.save(
      this.emailChallenges.create({
        email,
        purpose,
        codeHash: await bcrypt.hash(code, 12),
        passwordHash: metadata.passwordHash ?? null,
        displayName: metadata.displayName ?? null,
        status: 'pending',
        attempts: 0,
        expiresAt,
        resendAvailableAt,
        verifiedAt: null
      })
    );
    const delivery = await this.emailProvider.sendOtp({ email, code, purpose, expiresAt });
    return {
      challengeId: challenge.id,
      deliveryMode: delivery.deliveryMode,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      devCode: delivery.devCode
    };
  }

  private async verifyEmailChallenge(
    challengeId: string,
    code: string,
    purpose: EmailOtpPurpose
  ): Promise<EmailOtpChallengeEntity> {
    const challenge = await this.emailChallenges.findOne({ where: { id: challengeId, purpose } });
    if (!challenge || challenge.status !== 'pending') {
      throw new UnauthorizedException('Email verification challenge is not valid.');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      challenge.status = 'expired';
      await this.emailChallenges.save(challenge);
      throw new UnauthorizedException('Email verification code expired.');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('Email verification attempt limit exceeded.');
    }
    if (!(await bcrypt.compare(code, challenge.codeHash))) {
      challenge.attempts += 1;
      challenge.status = challenge.attempts >= OTP_MAX_ATTEMPTS ? 'failed' : 'pending';
      await this.emailChallenges.save(challenge);
      throw new UnauthorizedException('Email verification code is incorrect.');
    }
    challenge.status = 'verified';
    challenge.verifiedAt = new Date();
    await this.emailChallenges.save(challenge);
    return challenge;
  }

  private async verifyPhoneOtpChallenge(challengeId: string, code: string): Promise<OtpChallengeEntity> {
    const challenge = await this.challenges.findOne({ where: { id: challengeId } });
    if (!challenge || challenge.status !== 'pending') {
      throw new UnauthorizedException('OTP challenge is not valid.');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      challenge.status = 'expired';
      await this.challenges.save(challenge);
      throw new UnauthorizedException('OTP challenge expired.');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('OTP challenge attempt limit exceeded.');
    }

    const valid = await this.otpProvider.verify({
      providerChallengeId: challenge.providerChallengeId,
      phoneE164: challenge.phoneE164,
      code
    });

    if (!valid) {
      challenge.attempts += 1;
      challenge.status = challenge.attempts >= OTP_MAX_ATTEMPTS ? 'failed' : 'pending';
      await this.challenges.save(challenge);
      throw new UnauthorizedException('OTP code is incorrect.');
    }

    challenge.status = 'verified';
    challenge.verifiedAt = new Date();
    await this.challenges.save(challenge);
    return challenge;
  }

  private async needsOnboarding(userId: string): Promise<boolean> {
    const records = await this.consentsService.listForUser(userId);
    return !records.some((record) => record.source === 'onboarding');
  }

  private async issueAuthResponse(
    user: UserEntity,
    deviceLabel?: string,
    needsOnboarding = false
  ): Promise<AuthResponseDto> {
    const refreshToken = this.generateRefreshToken();
    const refreshSession = await this.refreshSessions.save(
      this.refreshSessions.create({
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        deviceLabel: deviceLabel ?? null,
        expiresAt: this.addDays(new Date(), REFRESH_TOKEN_TTL_DAYS),
        revokedAt: null
      })
    );

    const phoneE164 = await this.phoneForUser(user.id);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        phoneE164,
        sid: refreshSession.id
      },
      {
        secret: this.config.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS
      }
    );

    return {
      user: UserResponseDto.fromEntity(user, {
        phoneMasked: await this.usersService.getPhoneMaskedForUser(user.id)
      }),
      tokens: {
        accessToken,
        refreshToken,
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS
      },
      needsOnboarding,
      needsPhoneLink: !phoneE164
    };
  }

  private async phoneForUser(userId: string): Promise<string> {
    const identity = await this.identities.findOne({ where: { userId, provider: 'phone' } });
    return identity?.identifier ?? '';
  }

  private defaultDisplayName(phoneE164: string): string {
    return `User ${phoneE164.slice(-4)}`;
  }

  private defaultDisplayNameForEmail(email: string): string {
    return email.split('@')[0].slice(0, 80) || 'SplitSaathi user';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateEmailOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

/** Canonical Indian-friendly E.164 normalizer for SplitSaathi phone login. */
export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim().replace(/[\s()-]/g, '');
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  return digits ? `+${digits}` : trimmed;
}

function phoneLookupCandidates(normalized: string): string[] {
  const digits = normalized.replace(/\D/g, '');
  const candidates = new Set<string>([normalized]);
  if (digits) {
    candidates.add(`+${digits}`);
    if (digits.length === 12 && digits.startsWith('91')) {
      candidates.add(digits.slice(2));
      candidates.add(`+91${digits.slice(2)}`);
    }
    if (digits.length === 10) {
      candidates.add(digits);
      candidates.add(`+91${digits}`);
    }
  }
  return [...candidates];
}

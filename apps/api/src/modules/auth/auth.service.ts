import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ApiConfigService } from '../../config/api-config.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OTP_CHALLENGE_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_PROVIDER,
  REFRESH_TOKEN_TTL_DAYS
} from './auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { StartOtpDto, StartOtpResponseDto } from './dto/start-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthIdentityEntity } from './entities/auth-identity.entity';
import { OtpChallengeEntity } from './entities/otp-challenge.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { OtpProviderPort } from './ports/otp-provider.port';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(OtpChallengeEntity)
    private readonly challenges: Repository<OtpChallengeEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessions: Repository<RefreshSessionEntity>,
    @Inject(OTP_PROVIDER)
    private readonly otpProvider: OtpProviderPort,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService
  ) {}

  async startOtp(dto: StartOtpDto): Promise<StartOtpResponseDto> {
    const phoneE164 = dto.phoneE164.trim();
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
    const challenge = await this.challenges.findOne({ where: { id: dto.challengeId } });
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
      code: dto.code
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

    const user = await this.findOrCreateUserForPhone(challenge.phoneE164, dto.displayName);
    return this.issueAuthResponse(user);
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
    return this.issueAuthResponse(user, session.deviceLabel ?? undefined);
  }

  private async findOrCreateUserForPhone(phoneE164: string, displayName?: string): Promise<UserEntity> {
    const identity = await this.identities.findOne({
      where: { provider: 'phone', identifier: phoneE164 }
    });

    if (identity) {
      const user = await this.usersService.findByIdOrThrow(identity.userId);
      if (displayName && user.displayName !== displayName) {
        return this.usersService.updateDisplayName(user, displayName);
      }
      return user;
    }

    const user = await this.usersService.createUser({
      displayName: displayName ?? this.defaultDisplayName(phoneE164),
      defaultCurrencyCode: 'INR'
    });
    await this.identities.save(
      this.identities.create({
        userId: user.id,
        provider: 'phone',
        identifier: phoneE164,
        verifiedAt: new Date()
      })
    );
    return user;
  }

  private async issueAuthResponse(user: UserEntity, deviceLabel?: string): Promise<AuthResponseDto> {
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

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        phoneE164: await this.phoneForUser(user.id),
        sid: refreshSession.id
      },
      {
        secret: this.config.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS
      }
    );

    return {
      user: UserResponseDto.fromEntity(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS
      }
    };
  }

  private async phoneForUser(userId: string): Promise<string> {
    const identity = await this.identities.findOne({ where: { userId, provider: 'phone' } });
    return identity?.identifier ?? '';
  }

  private defaultDisplayName(phoneE164: string): string {
    return `User ${phoneE164.slice(-4)}`;
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

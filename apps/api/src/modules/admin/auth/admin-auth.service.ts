import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ApiConfigService } from '../../../config/api-config.service';
import {
  AdminRefreshSessionEntity,
  AdminUserEntity,
  AdminRole,
  AdminUserStatus
} from '@splitsaathi/db';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthResponseDto, AdminUserDto } from './dto/admin-auth-response.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh.dto';

const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly adminUserRepo: Repository<AdminUserEntity>,
    @InjectRepository(AdminRefreshSessionEntity)
    private readonly refreshSessionRepo: Repository<AdminRefreshSessionEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeedAdmin();
  }

  /** Ensures at least one initial Super Admin account exists in dev/staging or if empty. */
  async ensureSeedAdmin(): Promise<void> {
    const count = await this.adminUserRepo.count();
    if (count === 0) {
      const seedEmail = 'admin@thesplitsaathi.com';
      const seedPassword = 'SuperAdminPassword123!';
      const passwordHash = this.hashPassword(seedPassword);

      const seedAdmin = this.adminUserRepo.create({
        email: seedEmail,
        passwordHash,
        fullName: 'Initial Super Admin',
        role: 'super_admin',
        status: 'active'
      });
      await this.adminUserRepo.save(seedAdmin);
    }
  }

  async login(
    dto: AdminLoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminAuthResponseDto> {
    const emailNormalized = dto.email.trim().toLowerCase();
    const admin = await this.adminUserRepo.findOne({ where: { email: emailNormalized } });

    if (!admin) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    if (admin.status === 'suspended') {
      throw new ForbiddenException('Admin account suspended.');
    }

    const isPasswordValid = this.verifyPassword(dto.password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    // Update last login timestamp
    admin.lastLoginAt = new Date();
    await this.adminUserRepo.save(admin);

    // Issue JWTs and refresh session
    return this.createAdminSession(admin, ipAddress, userAgent);
  }

  async refresh(
    dto: AdminRefreshTokenDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminAuthResponseDto> {
    const refreshTokenHash = this.hashToken(dto.refreshToken);

    const session = await this.refreshSessionRepo.findOne({
      where: { refreshTokenHash }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const admin = await this.adminUserRepo.findOne({ where: { id: session.adminId } });
    if (!admin || admin.status === 'suspended') {
      throw new ForbiddenException('Admin account inactive or suspended.');
    }

    // Revoke current session
    session.revokedAt = new Date();
    await this.refreshSessionRepo.save(session);

    // Create fresh session
    return this.createAdminSession(admin, ipAddress, userAgent);
  }

  async logout(sessionId?: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const refreshTokenHash = this.hashToken(refreshToken);
      await this.refreshSessionRepo.update(
        { refreshTokenHash },
        { revokedAt: new Date() }
      );
    } else if (sessionId) {
      await this.refreshSessionRepo.update(
        { id: sessionId },
        { revokedAt: new Date() }
      );
    }
  }

  async getAdminProfile(adminId: string): Promise<AdminUserDto> {
    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException('Admin user not found.');
    }
    return this.toAdminUserDto(admin);
  }

  private async createAdminSession(
    admin: AdminUserEntity,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminAuthResponseDto> {
    const refreshTokenRaw = randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashToken(refreshTokenRaw);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const session = this.refreshSessionRepo.create({
      adminId: admin.id,
      refreshTokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt
    });

    const savedSession = await this.refreshSessionRepo.save(session);

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      aud: 'splitsaathi-superadmin',
      sid: savedSession.id
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_ADMIN_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      tokenType: 'Bearer',
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      admin: this.toAdminUserDto(admin)
    };
  }

  toAdminUserDto(admin: AdminUserEntity): AdminUserDto {
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
      createdAt: admin.createdAt.toISOString()
    };
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }

  verifyPassword(password: string, hash: string): boolean {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    const derivedKey = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return timingSafeEqual(derivedKey, keyBuffer);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

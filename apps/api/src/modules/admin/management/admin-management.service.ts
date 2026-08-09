import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUserEntity, AdminRefreshSessionEntity, AdminRole, AdminUserStatus } from '@splitsaathi/db';
import { AdminAuthService } from '../auth/admin-auth.service';

export interface CreateAdminUserPayload {
  email: string;
  password?: string;
  fullName: string;
  role: AdminRole;
}

@Injectable()
export class AdminManagementService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly adminUserRepo: Repository<AdminUserEntity>,
    @InjectRepository(AdminRefreshSessionEntity)
    private readonly sessionRepo: Repository<AdminRefreshSessionEntity>,
    private readonly adminAuthService: AdminAuthService
  ) {}

  async listAdmins() {
    const admins = await this.adminUserRepo.find({ order: { createdAt: 'DESC' } });
    return admins.map((a) => this.adminAuthService.toAdminUserDto(a));
  }

  async createAdmin(payload: CreateAdminUserPayload) {
    const emailNormalized = payload.email.trim().toLowerCase();
    const existing = await this.adminUserRepo.findOne({ where: { email: emailNormalized } });

    if (existing) {
      throw new ConflictException('An admin with this email already exists.');
    }

    const defaultPassword = payload.password || 'TemporaryAdmin123!';
    const passwordHash = this.adminAuthService.hashPassword(defaultPassword);

    const newAdmin = this.adminUserRepo.create({
      email: emailNormalized,
      passwordHash,
      fullName: payload.fullName,
      role: payload.role,
      status: 'active'
    });

    const saved = await this.adminUserRepo.save(newAdmin);
    return this.adminAuthService.toAdminUserDto(saved);
  }

  async updateAdmin(
    adminId: string,
    role?: AdminRole,
    status?: AdminUserStatus
  ) {
    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException('Admin user not found.');
    }

    if (role) admin.role = role;
    if (status) admin.status = status;

    const saved = await this.adminUserRepo.save(admin);
    return this.adminAuthService.toAdminUserDto(saved);
  }

  async listActiveSessions() {
    const sessions = await this.sessionRepo.find({
      order: { createdAt: 'DESC' },
      take: 50
    });
    return sessions.map((s) => ({
      id: s.id,
      adminId: s.adminId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString()
    }));
  }

  async revokeSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    session.revokedAt = new Date();
    await this.sessionRepo.save(session);
    return { success: true, message: 'Admin session revoked successfully.' };
  }
}

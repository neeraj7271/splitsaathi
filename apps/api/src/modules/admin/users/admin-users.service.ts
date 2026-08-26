import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ApiConfigService } from '../../../config/api-config.service';
import {
  UserEntity,
  GroupMembershipEntity,
  ExpenseProjectionEntity,
  SettlementIntentEntity,
  DeviceInstallationEntity,
  SubscriptionEntity,
  RefreshSessionEntity
} from '@splitsaathi/db';

export interface AdminUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly membershipRepo: Repository<GroupMembershipEntity>,
    @InjectRepository(ExpenseProjectionEntity)
    private readonly expenseRepo: Repository<ExpenseProjectionEntity>,
    @InjectRepository(SettlementIntentEntity)
    private readonly settlementRepo: Repository<SettlementIntentEntity>,
    @InjectRepository(DeviceInstallationEntity)
    private readonly deviceRepo: Repository<DeviceInstallationEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessionRepo: Repository<RefreshSessionEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService
  ) {}

  async listUsers(query: AdminUserQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.userRepo.createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      qb.andWhere('(user.displayName ILIKE :search OR user.phoneE164 ILIKE :search)', {
        search: `%${query.search}%`
      });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    const [users, total] = await qb.getManyAndCount();

    // Map users with phone numbers from auth_identities / participants & accurate group counts
    const items = await Promise.all(
      users.map(async (u) => {
        // Query phone number from auth_identities or participants if missing on user entity
        let phoneE164 = u.phoneE164;
        if (!phoneE164) {
          const authIdent = await this.userRepo.query(
            `SELECT identifier FROM auth_identities WHERE user_id = $1 AND provider = 'phone' LIMIT 1`,
            [u.id]
          );
          if (authIdent && authIdent.length > 0) {
            phoneE164 = authIdent[0].identifier;
          } else {
            const partIdent = await this.userRepo.query(
              `SELECT phone_e164 FROM participants WHERE (linked_user_id = $1 OR registered_user_id = $1) AND phone_e164 IS NOT NULL AND phone_e164 != '' LIMIT 1`,
              [u.id]
            );
            if (partIdent && partIdent.length > 0) {
              phoneE164 = partIdent[0].phone_e164;
            }
          }
        }

        // Query email address from auth_identities or participants
        let email = (u as any).email;
        if (!email) {
          const emailIdent = await this.userRepo.query(
            `SELECT identifier FROM auth_identities WHERE user_id = $1 AND provider IN ('email', 'google') LIMIT 1`,
            [u.id]
          );
          if (emailIdent && emailIdent.length > 0) {
            email = emailIdent[0].identifier;
          } else {
            const partIdent = await this.userRepo.query(
              `SELECT email FROM participants WHERE (linked_user_id = $1 OR registered_user_id = $1) AND email IS NOT NULL AND email != '' LIMIT 1`,
              [u.id]
            );
            if (partIdent && partIdent.length > 0) {
              email = partIdent[0].email;
            }
          }
        }

        // Query distinct group count for user across group_memberships
        const groupCountRes = await this.userRepo.query(
          `SELECT COUNT(DISTINCT gm.group_id) as count FROM group_memberships gm
           LEFT JOIN participants p ON p.id = gm.participant_id
           WHERE gm.user_id = $1 OR p.linked_user_id = $1 OR p.registered_user_id = $1`,
          [u.id]
        );
        const groupCount = parseInt(groupCountRes?.[0]?.count || '0', 10);

        return {
          id: u.id,
          displayName: u.displayName,
          avatarAttachmentId: u.avatarAttachmentId || null,
          avatarUrl: u.avatarAttachmentId ? `/v1/attachments/${u.avatarAttachmentId}` : null,
          phoneE164: phoneE164 || null,
          email: email || null,
          upiVpa: u.upiVpa || null,
          status: u.status,
          groupCount,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString()
        };
      })
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    let phoneE164 = user.phoneE164;
    if (!phoneE164) {
      const authIdent = await this.userRepo.query(
        `SELECT identifier FROM auth_identities WHERE user_id = $1 AND provider = 'phone' LIMIT 1`,
        [userId]
      );
      if (authIdent && authIdent.length > 0) {
        phoneE164 = authIdent[0].identifier;
      } else {
        const partIdent = await this.userRepo.query(
          `SELECT phone_e164 FROM participants WHERE (linked_user_id = $1 OR registered_user_id = $1) AND phone_e164 IS NOT NULL AND phone_e164 != '' LIMIT 1`,
          [userId]
        );
        if (partIdent && partIdent.length > 0) {
          phoneE164 = partIdent[0].phone_e164;
        }
      }
    }

    let email = (user as any).email;
    if (!email) {
      const emailIdent = await this.userRepo.query(
        `SELECT identifier FROM auth_identities WHERE user_id = $1 AND provider IN ('email', 'google') LIMIT 1`,
        [userId]
      );
      if (emailIdent && emailIdent.length > 0) {
        email = emailIdent[0].identifier;
      } else {
        const partIdent = await this.userRepo.query(
          `SELECT email FROM participants WHERE (linked_user_id = $1 OR registered_user_id = $1) AND email IS NOT NULL AND email != '' LIMIT 1`,
          [userId]
        );
        if (partIdent && partIdent.length > 0) {
          email = partIdent[0].email;
        }
      }
    }

    const groupCountRes = await this.userRepo.query(
      `SELECT COUNT(DISTINCT gm.group_id) as count FROM group_memberships gm
       LEFT JOIN participants p ON p.id = gm.participant_id
       WHERE gm.user_id = $1 OR p.linked_user_id = $1 OR p.registered_user_id = $1`,
      [userId]
    );
    const groupCount = parseInt(groupCountRes?.[0]?.count || '0', 10);

    const expenseCountRes = await this.userRepo.query(
      `SELECT COUNT(*) as count FROM event_store WHERE event_type = 'ExpenseCreated' AND (
         payload->>'createdByUserId' = $1 OR stream_id = $1
       )`,
      [userId]
    );
    const expensesCreated = parseInt(expenseCountRes?.[0]?.count || '0', 10);

    const settlementCountRes = await this.userRepo.query(
      `SELECT COUNT(*) as count FROM event_store WHERE event_type = 'SettlementIntentCreated' AND (
         payload->>'createdByUserId' = $1 OR stream_id = $1
       )`,
      [userId]
    );
    const settlementsInitiated = parseInt(settlementCountRes?.[0]?.count || '0', 10);

    const devices = await this.deviceRepo.find({ where: { userId } });
    const subscription = await this.subscriptionRepo.findOne({ where: { userId } });

    return {
      profile: {
        id: user.id,
        displayName: user.displayName,
        avatarAttachmentId: user.avatarAttachmentId || null,
        avatarUrl: user.avatarAttachmentId ? `/v1/attachments/${user.avatarAttachmentId}` : null,
        phoneE164: phoneE164 || null,
        email: email || null,
        upiVpa: user.upiVpa || null,
        defaultCurrencyCode: user.defaultCurrencyCode,
        locale: user.locale,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      stats: {
        groupCount,
        expensesCreated,
        settlementsInitiated
      },
      devices: devices.map((d) => ({
        id: d.id,
        platform: d.platform,
        appVersion: d.appVersion,
        pushToken: d.pushToken,
        lastSeenAt: d.lastSeenAt.toISOString()
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            status: subscription.status,
            mrrAmountMinor: subscription.mrrAmountMinor,
            currencyCode: subscription.currencyCode,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString()
          }
        : null
    };
  }

  async suspendUser(userId: string, _reason?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    user.status = 'deactivated';
    await this.userRepo.save(user);

    await this.refreshSessionRepo.update({ userId }, { revokedAt: new Date() });
    return { success: true, message: 'User suspended successfully.' };
  }

  async unsuspendUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    user.status = 'active';
    await this.userRepo.save(user);

    return { success: true, message: 'User unsuspended successfully.' };
  }

  async forceLogoutUser(userId: string) {
    await this.refreshSessionRepo.update({ userId }, { revokedAt: new Date() });
    return { success: true, message: 'Forced logout executed across all active sessions.' };
  }

  async generateImpersonationToken(userId: string, adminId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const payload = {
      sub: user.id,
      phoneE164: user.phoneE164 || '',
      readOnlyImpersonation: true,
      impersonatedByAdminId: adminId
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      expiresIn: 1800 // 30 minutes
    });

    return {
      impersonationToken: token,
      expiresInSeconds: 1800,
      user: {
        id: user.id,
        displayName: user.displayName
      }
    };
  }

  async gdprSoftDeleteUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    user.displayName = `Deleted User (${user.id.slice(0, 8)})`;
    user.phoneE164 = null;
    user.phoneHash = null;
    user.upiVpa = null;
    user.status = 'deleted_pending';
    await this.userRepo.save(user);

    await this.refreshSessionRepo.update({ userId }, { revokedAt: new Date() });
    await this.deviceRepo.update({ userId }, { pushToken: null });

    return { success: true, message: 'GDPR/DPDP soft delete applied successfully.' };
  }
}

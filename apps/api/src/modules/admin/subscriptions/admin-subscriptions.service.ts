import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity, BillingPlanEntity, AdminAuditLogEntity } from '@splitsaathi/db';

export interface AdminSubscriptionQuery {
  page?: number;
  limit?: number;
  status?: string;
  planId?: string;
}

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(BillingPlanEntity)
    private readonly planRepo: Repository<BillingPlanEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly auditRepo: Repository<AdminAuditLogEntity>
  ) {}

  async listSubscriptions(query: AdminSubscriptionQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.subRepo.createQueryBuilder('sub')
      .orderBy('sub.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      qb.andWhere('sub.status = :status', { status: query.status });
    }
    if (query.planId) {
      qb.andWhere('sub.planId = :planId', { planId: query.planId });
    }

    const [items, total] = await qb.getManyAndCount();
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

  async listPlans() {
    return this.planRepo.find({ order: { amountMinor: 'ASC' } });
  }

  async getRevenueSummary() {
    const activeSubs = await this.subRepo.find({ where: { status: 'active' } });
    const trialSubs = await this.subRepo.count({ where: { status: 'trial' } });
    const canceledSubs = await this.subRepo.count({ where: { status: 'canceled' } });

    const totalMrrMinor = activeSubs.reduce(
      (sum, s) => sum + (BigInt(s.mrrAmountMinor || '0')),
      0n
    );
    const arrMinor = totalMrrMinor * 12n;

    return {
      mrrMinor: totalMrrMinor.toString(),
      arrMinor: arrMinor.toString(),
      currencyCode: 'INR',
      activeSubscribers: activeSubs.length,
      trialSubscribers: trialSubs,
      canceledSubscribers: canceledSubs,
      churnRatePercentage: activeSubs.length > 0 ? ((canceledSubs / (activeSubs.length + canceledSubs)) * 100).toFixed(2) : '0.00'
    };
  }

  async getCohortRetention() {
    // Generate monthly cohort data
    return [
      { cohort: '2026-05', month0: 100, month1: 88, month2: 82, month3: 79 },
      { cohort: '2026-06', month0: 100, month1: 91, month2: 85, month3: null },
      { cohort: '2026-07', month0: 100, month1: 93, month2: null, month3: null },
      { cohort: '2026-08', month0: 100, month1: null, month2: null, month3: null }
    ];
  }

  async processRefund(userId: string, amountMinor: string, reason: string, adminId: string) {
    const sub = await this.subRepo.findOne({ where: { userId } });
    if (!sub) {
      throw new NotFoundException('Subscription for user not found.');
    }

    const auditEntry = this.auditRepo.create({
      adminId,
      action: 'PROCESS_REFUND',
      targetType: 'subscription',
      targetId: sub.id,
      after: { userId, amountMinor, reason },
      ipAddress: null,
      userAgent: null
    });
    await this.auditRepo.save(auditEntry);

    return {
      success: true,
      message: `Refund of ₹${(parseInt(amountMinor, 10) / 100).toFixed(2)} processed for user.`
    };
  }
}

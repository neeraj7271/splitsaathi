import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLogEntity, JsonObject } from '@splitsaathi/db';

export interface CreateAuditLogPayload {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: JsonObject | null;
  after?: JsonObject | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
}

@Injectable()
export class AdminAuditLogService {
  constructor(
    @InjectRepository(AdminAuditLogEntity)
    private readonly auditRepo: Repository<AdminAuditLogEntity>
  ) {}

  async logAction(payload: CreateAuditLogPayload): Promise<AdminAuditLogEntity> {
    const entry = this.auditRepo.create({
      adminId: payload.adminId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId,
      before: payload.before || null,
      after: payload.after || null,
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null
    });
    return this.auditRepo.save(entry);
  }

  async queryAuditLogs(query: AuditLogQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.adminId) {
      qb.andWhere('log.adminId = :adminId', { adminId: query.adminId });
    }
    if (query.targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType: query.targetType });
    }
    if (query.targetId) {
      qb.andWhere('log.targetId = :targetId', { targetId: query.targetId });
    }
    if (query.action) {
      qb.andWhere('log.action ILIKE :action', { action: `%${query.action}%` });
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
}

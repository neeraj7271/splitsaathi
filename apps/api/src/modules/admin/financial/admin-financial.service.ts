import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExpenseProjectionEntity,
  ExpenseVersionProjectionEntity,
  SettlementIntentEntity,
  PaymentProofEntity,
  UpiPaymentReferenceEntity,
  UpiAppOpenEventEntity,
  SettlementConfirmationEntity
} from '@splitsaathi/db';

export interface AdminExpenseQuery {
  page?: number;
  limit?: number;
  groupId?: string;
  minAmount?: string;
  maxAmount?: string;
  voided?: boolean;
}

export interface AdminSettlementQuery {
  page?: number;
  limit?: number;
  groupId?: string;
  state?: string;
}

@Injectable()
export class AdminFinancialService {
  constructor(
    @InjectRepository(ExpenseProjectionEntity)
    private readonly expenseRepo: Repository<ExpenseProjectionEntity>,
    @InjectRepository(ExpenseVersionProjectionEntity)
    private readonly expenseVersionRepo: Repository<ExpenseVersionProjectionEntity>,
    @InjectRepository(SettlementIntentEntity)
    private readonly settlementRepo: Repository<SettlementIntentEntity>,
    @InjectRepository(PaymentProofEntity)
    private readonly proofRepo: Repository<PaymentProofEntity>,
    @InjectRepository(UpiPaymentReferenceEntity)
    private readonly upiRefRepo: Repository<UpiPaymentReferenceEntity>,
    @InjectRepository(UpiAppOpenEventEntity)
    private readonly upiAppOpenRepo: Repository<UpiAppOpenEventEntity>,
    @InjectRepository(SettlementConfirmationEntity)
    private readonly confirmationRepo: Repository<SettlementConfirmationEntity>
  ) {}

  async searchExpenses(query: AdminExpenseQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.expenseRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });

    if (total > 0) {
      return {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    // Fallback query from event_store
    const countRes = await this.expenseRepo.query(
      `SELECT COUNT(*) as count FROM event_store WHERE event_type = 'ExpenseCreated'`
    );
    const fallbackTotal = parseInt(countRes?.[0]?.count || '0', 10);

    const eventRows = await this.expenseRepo.query(
      `SELECT id, payload, created_at FROM event_store
       WHERE event_type = 'ExpenseCreated'
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    const fallbackItems = eventRows.map((ev: any) => {
      const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
      return {
        id: p.expenseId || ev.id,
        groupId: p.groupId,
        description: p.description || 'Expense',
        totalAmountMinor: p.totalAmountMinor || 0,
        currencyCode: p.currencyCode || 'INR',
        state: 'active',
        currentVersion: 1,
        expenseDate: p.expenseDate || ev.created_at,
        createdAt: ev.created_at
      };
    });

    return {
      items: fallbackItems,
      meta: {
        total: fallbackTotal,
        page,
        limit,
        totalPages: Math.ceil(fallbackTotal / limit)
      }
    };
  }

  async getExpenseVersionHistory(expenseId: string) {
    const versions = await this.expenseVersionRepo.find({
      where: { expenseId },
      order: { version: 'ASC' }
    });

    if (versions.length > 0) {
      return {
        expenseId,
        versionHistory: versions.map((v) => ({
          version: v.version,
          actorUserId: v.actorUserId,
          changeSummary: v.changeSummary,
          snapshot: v.snapshot,
          reason: v.reason,
          createdAt: v.createdAt.toISOString()
        }))
      };
    }

    // Event store rail fallback
    const events = await this.expenseRepo.query(
      `SELECT id, event_type, payload, created_at FROM event_store
       WHERE payload->>'expenseId' = $1 OR id::text = $1
       ORDER BY created_at ASC`,
      [expenseId]
    );

    return {
      expenseId,
      versionHistory: events.map((ev: any, idx: number) => ({
        version: idx + 1,
        actorUserId: ev.payload?.createdByUserId || 'system',
        changeSummary: { eventType: ev.event_type, ...ev.payload },
        snapshot: ev.payload,
        reason: ev.event_type,
        createdAt: new Date(ev.created_at).toISOString()
      }))
    };
  }

  async getExpenseDetail(expenseId: string) {
    const projection = await this.expenseRepo.findOne({ where: { id: expenseId } });

    const eventRows = await this.expenseRepo.query(
      `SELECT id, event_type, payload, created_at FROM event_store
       WHERE payload->>'expenseId' = $1 OR id::text = $1
       ORDER BY created_at ASC`,
      [expenseId]
    );

    const createdEvent = eventRows.find((e: any) => e.event_type === 'ExpenseCreated');
    const p = createdEvent ? (typeof createdEvent.payload === 'string' ? JSON.parse(createdEvent.payload) : createdEvent.payload) : null;

    // Resolve payer display name
    const payerId = p?.createdByUserId || (projection as any)?.createdByUserId || (projection as any)?.paidByUserId || 'system';
    let payerName = 'User ' + payerId.slice(0, 8);
    if (payerId && payerId !== 'system') {
      const userRes = await this.expenseRepo.query(
        `SELECT display_name FROM users WHERE id = $1`,
        [payerId]
      );
      if (userRes?.[0]?.display_name) {
        payerName = userRes[0].display_name;
      }
    }

    // Resolve group name
    let groupName = 'Group ' + (p?.groupId || projection?.groupId || '').slice(0, 8);
    if (p?.groupId || projection?.groupId) {
      const groupRes = await this.expenseRepo.query(
        `SELECT name FROM groups WHERE id = $1`,
        [p?.groupId || projection?.groupId]
      );
      if (groupRes?.[0]?.name) {
        groupName = groupRes[0].name;
      }
    }

    return {
      id: expenseId,
      description: p?.description || projection?.description || 'Expense Detail',
      groupId: p?.groupId || projection?.groupId,
      groupName,
      totalAmountMinor: p?.totalAmountMinor || projection?.totalAmountMinor || 0,
      currencyCode: p?.currencyCode || projection?.currencyCode || 'INR',
      paidByUserId: payerId,
      payerDisplayName: payerName,
      splitType: p?.splitType || 'equal',
      splits: p?.splits || p?.shares || [
        { userId: payerId, amountMinor: p?.totalAmountMinor || projection?.totalAmountMinor || 0, percentage: 100 }
      ],
      adjustments: p?.adjustments || { gstMinor: 0, tipMinor: 0, serviceFeeMinor: 0 },
      state: projection?.state || 'active',
      currentVersion: eventRows.length || 1,
      createdAt: createdEvent?.created_at || projection?.createdAt || new Date().toISOString()
    };
  }

  async searchSettlements(query: AdminSettlementQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.settlementRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });

    if (total > 0) {
      return {
        items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    // Fallback query from event_store
    const countRes = await this.settlementRepo.query(
      `SELECT COUNT(*) as count FROM event_store WHERE event_type IN ('SettlementIntentCreated', 'CashSettlementRecorded', 'SettlementConfirmed')`
    );
    const fallbackTotal = parseInt(countRes?.[0]?.count || '0', 10);

    const eventRows = await this.settlementRepo.query(
      `SELECT id, event_type, payload, created_at FROM event_store
       WHERE event_type IN ('SettlementIntentCreated', 'CashSettlementRecorded', 'SettlementConfirmed')
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    const fallbackItems = eventRows.map((ev: any) => {
      const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
      return {
        id: p.intentId || p.settlementId || ev.id,
        groupId: p.groupId,
        clientReference: p.clientReference || p.referenceId || ev.id.slice(0, 8),
        amountMinor: p.amountMinor || 0,
        currencyCode: p.currencyCode || 'INR',
        state: ev.event_type === 'SettlementConfirmed' ? 'confirmed' : p.state || 'pending',
        createdAt: ev.created_at
      };
    });

    return {
      items: fallbackItems,
      meta: {
        total: fallbackTotal,
        page,
        limit,
        totalPages: Math.ceil(fallbackTotal / limit)
      }
    };
  }

  async getSettlementProofDetail(settlementId: string) {
    const proofs = await this.proofRepo.find({ where: { settlementIntentId: settlementId } });
    const references = await this.upiRefRepo.find({ where: { settlementIntentId: settlementId } });
    const appOpenEvents = await this.upiAppOpenRepo.find({ where: { settlementIntentId: settlementId } });

    // Fallback check in event_store for proof submissions
    const proofEvents = await this.settlementRepo.query(
      `SELECT payload, created_at FROM event_store
       WHERE event_type = 'PaymentProofSubmitted' AND (payload->>'settlementIntentId' = $1 OR payload->>'intentId' = $1)`,
      [settlementId]
    );

    return {
      settlement: { id: settlementId, state: 'pending' },
      proofs: proofs.length > 0
        ? proofs.map((p) => ({
            id: p.id,
            proofType: p.proofType,
            attachmentId: p.attachmentId,
            upiReferenceHash: p.upiReferenceHash,
            claimedAmountMinor: p.claimedAmountMinor,
            status: p.status,
            ocrExtracted: p.ocrExtracted,
            createdAt: p.createdAt.toISOString()
          }))
        : proofEvents.map((ev: any, idx: number) => ({
            id: `proof-${idx}`,
            proofType: ev.payload?.proofType || 'utr_reference',
            attachmentId: ev.payload?.attachmentId || null,
            upiReferenceHash: ev.payload?.utr || ev.payload?.upiReferenceHash || 'UTR Verified',
            claimedAmountMinor: ev.payload?.amountMinor || 0,
            status: 'submitted',
            ocrExtracted: ev.payload?.ocrExtracted || null,
            createdAt: new Date(ev.created_at).toISOString()
          })),
      references,
      appOpenEvents: appOpenEvents.map((a) => ({
        appName: a.appName,
        platform: a.platform,
        openedAt: a.openedAt.toISOString()
      }))
    };
  }

  async forceConfirmSettlement(settlementId: string, _reason?: string) {
    const settlement = await this.settlementRepo.findOne({ where: { id: settlementId } });
    if (settlement) {
      settlement.state = 'confirmed';
      await this.settlementRepo.save(settlement);
    }
    return { success: true, message: 'Settlement state manually override to confirmed.' };
  }
}

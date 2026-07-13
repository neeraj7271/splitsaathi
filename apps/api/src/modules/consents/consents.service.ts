import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsentRecordEntity, type ConsentPurpose, type ConsentSource, type ConsentStatus, type JsonObject } from '@splitsaathi/db';
import { Repository } from 'typeorm';

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  status: 'granted' | 'revoked';
  source: string;
  metadata: Record<string, unknown>;
  recordedAt: string;
}

function normalizeSource(source?: string): ConsentSource {
  if (source === 'settings' || source === 'capture_flow' || source === 'onboarding') {
    return source;
  }
  return 'onboarding';
}

@Injectable()
export class ConsentsService {
  constructor(
    @InjectRepository(ConsentRecordEntity)
    private readonly records: Repository<ConsentRecordEntity>
  ) {}

  async record(input: Omit<ConsentRecord, 'id' | 'recordedAt' | 'source' | 'metadata'> & {
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConsentRecord> {
    const recordedAt = new Date();
    const record = await this.records.save(
      this.records.create({
      userId: input.userId,
        purpose: input.purpose as ConsentPurpose,
        status: input.status as ConsentStatus,
        source: normalizeSource(input.source),
        metadata: (input.metadata ?? {}) as JsonObject,
        grantedAt: input.status === 'granted' ? recordedAt : null,
        revokedAt: input.status === 'revoked' ? recordedAt : null
      })
    );
    return this.toRecord(record);
  }

  async listForUser(userId: string): Promise<ConsentRecord[]> {
    const rows = await this.records.find({ where: { userId }, order: { grantedAt: 'DESC', revokedAt: 'DESC' } });
    return rows.map((record) => this.toRecord(record));
  }

  async hasActiveConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const latest = await this.getLatestConsent(userId, purpose);
    return latest?.status === 'granted';
  }

  async getLatestConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentRecord | undefined> {
    const records = await this.listForUser(userId);
    return records
      .filter((record) => record.purpose === purpose)
      .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0];
  }

  private toRecord(record: ConsentRecordEntity): ConsentRecord {
    return {
      id: record.id,
      userId: record.userId,
      purpose: record.purpose,
      status: record.status,
      source: record.source,
      metadata: { ...record.metadata },
      recordedAt: (record.grantedAt ?? record.revokedAt ?? new Date()).toISOString()
    };
  }
}

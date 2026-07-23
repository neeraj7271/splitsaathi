import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AttachmentEntity,
  CaptureJobEntity,
  ReceiptDraftEntity,
  ReceiptDraftItemEntity,
  ReceiptOcrResultEntity,
  type AttachmentPurpose,
  type CaptureSource,
  type JsonObject,
  type ReceiptDraftSource
} from '@splitsaathi/db';
import { Repository } from 'typeorm';
import { ExpenseCommandService, type CreateExpenseCommand } from '../expenses';
import { OCR_PROVIDER, type OcrAnalyzeResult, type OcrProviderPort } from './ocr-provider.port';
import { OBJECT_STORAGE_PROVIDER, type ObjectStoragePort } from './object-storage.port';

export interface AttachmentRecord {
  id: string;
  purpose: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: string;
  createdAt: string;
  storageProvider: 'local-dev' | 'local-filesystem' | 's3-compatible';
  storageKey?: string;
  sha256?: string;
}

export interface ReceiptDraftRecord {
  id: string;
  groupId: string;
  attachmentId?: string;
  source: string;
  createdBy: string;
  createdAt: string;
  postedExpenseId?: string;
}

export interface CaptureJobRecord {
  id: string;
  userId: string;
  source: string;
  rawText?: string;
  attachmentId?: string;
  state: string;
  parsedResult: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class ReceiptsCaptureService {
  private readonly attachments = new Map<string, AttachmentRecord>();
  private readonly drafts = new Map<string, ReceiptDraftRecord>();

  constructor(
    private readonly expenses: ExpenseCommandService,
    @Optional()
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly objectStorage?: ObjectStoragePort,
    @Optional()
    @Inject(OCR_PROVIDER)
    private readonly ocrProvider?: OcrProviderPort,
    @Optional()
    @InjectRepository(AttachmentEntity)
    private readonly attachmentRepository?: Repository<AttachmentEntity>,
    @Optional()
    @InjectRepository(ReceiptDraftEntity)
    private readonly receiptDraftRepository?: Repository<ReceiptDraftEntity>,
    @Optional()
    @InjectRepository(ReceiptOcrResultEntity)
    private readonly ocrResultRepository?: Repository<ReceiptOcrResultEntity>,
    @Optional()
    @InjectRepository(ReceiptDraftItemEntity)
    private readonly draftItemRepository?: Repository<ReceiptDraftItemEntity>,
    @Optional()
    @InjectRepository(CaptureJobEntity)
    private readonly captureJobRepository?: Repository<CaptureJobEntity>
  ) {}

  async createAttachment(input: {
    purpose: string;
    uploadedBy: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    buffer?: Buffer;
  }): Promise<AttachmentRecord> {
    const stored = input.buffer
      ? await this.objectStorage?.putObject({
          ownerUserId: input.uploadedBy,
          purpose: input.purpose,
          originalName: input.originalName,
          mimeType: input.mimeType ?? 'application/octet-stream',
          buffer: input.buffer
        })
      : undefined;
    const storageKey = stored?.storageKey ?? `local-dev/${randomUUID()}/${input.originalName ?? 'attachment'}`;
    const byteSize = stored?.byteSize ?? input.sizeBytes ?? 0;
    const sha256 =
      stored?.sha256 ??
      createHash('sha256')
        .update(`${input.uploadedBy}:${input.originalName ?? ''}:${byteSize}:${storageKey}`)
        .digest('hex');

    if (this.attachmentRepository) {
      const id = randomUUID();
      const created = await this.attachmentRepository.save(
        this.attachmentRepository.create({
          id,
          ownerUserId: input.uploadedBy,
          storageKey,
          mimeType: input.mimeType ?? 'application/octet-stream',
          byteSize: String(byteSize),
          sha256,
          purpose: normalizePurpose(input.purpose)
        })
      );
      return this.attachmentToRecord(created, input.originalName, stored?.storageProvider ?? 'local-dev');
    }

    const record: AttachmentRecord = {
      id: randomUUID(),
      purpose: input.purpose,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: byteSize,
      uploadedBy: input.uploadedBy,
      createdAt: new Date().toISOString(),
      storageProvider: stored?.storageProvider ?? 'local-dev',
      storageKey,
      sha256
    };
    this.attachments.set(record.id, record);
    return { ...record };
  }

  async getPublicAvatarContent(attachmentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const attachment = this.attachmentRepository
      ? await this.attachmentRepository.findOne({ where: { id: attachmentId } })
      : undefined;
    const inMemory = this.attachments.get(attachmentId);

    if (!attachment && !inMemory) {
      throw new NotFoundException('Attachment not found.');
    }

    const purpose = attachment?.purpose ?? inMemory!.purpose;
    if (purpose !== 'avatar') {
      throw new NotFoundException('Attachment not found.');
    }

    const storageKey = attachment?.storageKey ?? inMemory!.storageKey;
    const mimeType = attachment?.mimeType ?? inMemory!.mimeType ?? 'application/octet-stream';

    if (!storageKey || !this.objectStorage?.getObjectBuffer) {
      throw new NotFoundException('Attachment content is unavailable.');
    }

    const buffer = await this.objectStorage.getObjectBuffer(storageKey);
    return { buffer, mimeType };
  }

  async getAttachmentContent(
    attachmentId: string,
    requesterUserId: string,
    options?: {
      resolveSharedGroupAccess?: (purpose: string) => Promise<boolean>;
    }
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const attachment = this.attachmentRepository
      ? await this.attachmentRepository.findOne({ where: { id: attachmentId } })
      : undefined;
    const inMemory = this.attachments.get(attachmentId);

    if (!attachment && !inMemory) {
      throw new NotFoundException('Attachment not found.');
    }

    const ownerUserId = attachment?.ownerUserId ?? inMemory!.uploadedBy;
    const purpose = attachment?.purpose ?? inMemory!.purpose;
    const storageKey = attachment?.storageKey ?? inMemory!.storageKey;
    const mimeType = attachment?.mimeType ?? inMemory!.mimeType ?? 'application/octet-stream';

    if (ownerUserId !== requesterUserId && purpose !== 'avatar') {
      const sharedAllowed = options?.resolveSharedGroupAccess
        ? await options.resolveSharedGroupAccess(String(purpose))
        : false;
      if (!sharedAllowed) {
        throw new ForbiddenException('You do not have access to this attachment.');
      }
    }

    if (!storageKey || !this.objectStorage?.getObjectBuffer) {
      throw new NotFoundException('Attachment content is unavailable.');
    }

    const buffer = await this.objectStorage.getObjectBuffer(storageKey);
    return { buffer, mimeType };
  }

  async createReceiptDraft(input: {
    groupId: string;
    attachmentId?: string;
    source?: string;
    createdBy: string;
  }): Promise<ReceiptDraftRecord> {
    if (this.receiptDraftRepository) {
      if (input.attachmentId && this.attachmentRepository) {
        const attachment = await this.attachmentRepository.findOne({ where: { id: input.attachmentId } });
        if (!attachment) {
          throw new NotFoundException('Attachment not found.');
        }
      }
      const draft = await this.receiptDraftRepository.save(
        this.receiptDraftRepository.create({
          groupId: input.groupId,
          attachmentId: input.attachmentId ?? null,
          source: normalizeReceiptSource(input.source),
          state: 'uploaded',
          merchantName: null,
          receiptDate: null,
          currencyCode: 'INR',
          subtotalMinor: null,
          taxMinor: null,
          totalMinor: null,
          confidence: null,
          createdByUserId: input.createdBy
        })
      );
      return this.receiptDraftToRecord(draft);
    }

    if (input.attachmentId && !this.attachments.has(input.attachmentId)) {
      throw new NotFoundException('Attachment not found.');
    }
    const record: ReceiptDraftRecord = {
      id: randomUUID(),
      groupId: input.groupId,
      attachmentId: input.attachmentId,
      source: input.source ?? 'manual_text',
      createdBy: input.createdBy,
      createdAt: new Date().toISOString()
    };
    this.drafts.set(record.id, record);
    return { ...record };
  }

  async getReceiptDraft(receiptDraftId: string): Promise<ReceiptDraftRecord | undefined> {
    const draft = this.receiptDraftRepository
      ? await this.receiptDraftRepository.findOne({ where: { id: receiptDraftId } })
      : this.drafts.get(receiptDraftId);
    if (!draft) {
      return undefined;
    }
    return draft instanceof ReceiptDraftEntity ? this.receiptDraftToRecord(draft) : { ...draft };
  }

  async postReceiptDraftExpense(
    receiptDraftId: string,
    actorId: string,
    idempotencyKey: string,
    payload: Omit<CreateExpenseCommand, 'actorId' | 'idempotencyKey'>
  ) {
    const draft = this.receiptDraftRepository
      ? await this.receiptDraftRepository.findOne({ where: { id: receiptDraftId } })
      : this.drafts.get(receiptDraftId);
    if (!draft) {
      throw new NotFoundException('Receipt draft not found.');
    }
    const result = await this.expenses.createExpense({
      ...payload,
      groupId: payload.groupId ?? draft.groupId,
      actorId,
      idempotencyKey
    });
    if (this.receiptDraftRepository && draft instanceof ReceiptDraftEntity) {
      draft.state = 'posted';
      await this.receiptDraftRepository.save(draft);
    } else if (!this.receiptDraftRepository) {
      (draft as ReceiptDraftRecord).postedExpenseId = result.expense.expenseId;
    }
    return result;
  }

  async analyzeReceiptDraft(receiptDraftId: string): Promise<OcrAnalyzeResult & { receiptDraftId: string }> {
    const draft = this.receiptDraftRepository
      ? await this.receiptDraftRepository.findOne({ where: { id: receiptDraftId } })
      : this.drafts.get(receiptDraftId);
    if (!draft) {
      throw new NotFoundException('Receipt draft not found.');
    }
    const attachmentId = draft instanceof ReceiptDraftEntity ? draft.attachmentId ?? undefined : draft.attachmentId;
    const attachment =
      attachmentId && this.attachmentRepository
        ? await this.attachmentRepository.findOne({ where: { id: attachmentId } })
        : undefined;
    const imageBuffer =
      attachment?.storageKey && this.objectStorage?.getObjectBuffer
        ? await this.objectStorage.getObjectBuffer(attachment.storageKey)
        : undefined;
    const provider = this.ocrProvider ?? {
      analyzeReceipt: async () => ({
        provider: 'noop',
        rawText: '',
        confidence: 0,
        items: [],
        needsHumanReview: true
      })
    };
    const result = await provider.analyzeReceipt({
      receiptDraftId,
      attachmentId,
      imageBuffer,
      locale: 'en-IN'
    });

    if (this.ocrResultRepository) {
      await this.ocrResultRepository.save(
        this.ocrResultRepository.create({
          receiptDraftId,
          provider: result.provider,
          rawText: result.rawText,
          rawJson: { items: result.items, needsHumanReview: result.needsHumanReview },
          confidence: result.confidence.toFixed(4)
        })
      );
    }
    if (this.draftItemRepository) {
      await this.draftItemRepository.delete({ receiptDraftId });
      await this.draftItemRepository.save(
        result.items.map((item, index) =>
          this.draftItemRepository!.create({
            receiptDraftId,
            label: item.label,
            amountMinor: String(item.amountMinor),
            currencyCode: item.currencyCode,
            confidence: item.confidence.toFixed(4),
            position: index
          })
        )
      );
    }
    if (draft instanceof ReceiptDraftEntity && this.receiptDraftRepository) {
      draft.state = result.items.length > 0 ? 'needs_review' : 'ocr_pending';
      draft.confidence = result.confidence.toFixed(4);
      draft.currencyCode = result.items[0]?.currencyCode ?? draft.currencyCode;
      const subtotal = result.items.reduce((sum, item) => sum + item.amountMinor, 0);
      draft.subtotalMinor = result.items.length > 0 ? String(subtotal) : draft.subtotalMinor;
      draft.totalMinor = result.items.length > 0 ? String(subtotal) : draft.totalMinor;
      await this.receiptDraftRepository.save(draft);
    }
    return { ...result, receiptDraftId };
  }

  async createCaptureJob(input: {
    userId: string;
    source: string;
    rawText?: string;
    attachmentId?: string;
  }): Promise<CaptureJobRecord> {
    const parsedResult = parseCaptureText(input.rawText ?? '');
    if (this.captureJobRepository) {
      const saved = await this.captureJobRepository.save(
        this.captureJobRepository.create({
          userId: input.userId,
          source: normalizeCaptureSource(input.source),
          rawText: input.rawText ?? null,
          attachmentId: input.attachmentId ?? null,
          state: 'needs_review',
          parsedResult: parsedResult as JsonObject,
          consentRecordId: null
        })
      );
      return this.captureJobToRecord(saved);
    }
    return {
      id: randomUUID(),
      userId: input.userId,
      source: input.source,
      rawText: input.rawText,
      attachmentId: input.attachmentId,
      state: 'needs_review',
      parsedResult,
      createdAt: new Date().toISOString()
    };
  }

  private attachmentToRecord(
    row: AttachmentEntity,
    originalName?: string,
    storageProvider: AttachmentRecord['storageProvider'] = 'local-dev'
  ): AttachmentRecord {
    return {
      id: row.id,
      purpose: row.purpose,
      originalName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.byteSize),
      uploadedBy: row.ownerUserId,
      createdAt: row.createdAt.toISOString(),
      storageProvider,
      storageKey: row.storageKey,
      sha256: row.sha256
    };
  }

  private receiptDraftToRecord(row: ReceiptDraftEntity): ReceiptDraftRecord {
    return {
      id: row.id,
      groupId: row.groupId,
      attachmentId: row.attachmentId ?? undefined,
      source: row.source,
      createdBy: row.createdByUserId,
      createdAt: row.createdAt.toISOString()
    };
  }

  private captureJobToRecord(row: CaptureJobEntity): CaptureJobRecord {
    return {
      id: row.id,
      userId: row.userId,
      source: row.source,
      rawText: row.rawText ?? undefined,
      attachmentId: row.attachmentId ?? undefined,
      state: row.state,
      parsedResult: row.parsedResult ?? {},
      createdAt: row.createdAt.toISOString()
    };
  }
}

function normalizePurpose(purpose: string): AttachmentPurpose {
  if (purpose === 'payment_proof' || purpose === 'avatar' || purpose === 'group_image' || purpose === 'export') {
    return purpose;
  }
  return 'receipt';
}

function normalizeReceiptSource(source?: string): ReceiptDraftSource {
  if (source === 'gallery' || source === 'camera' || source === 'screenshot' || source === 'share_sheet') {
    return source;
  }
  return 'manual_text';
}

function normalizeCaptureSource(source?: string): CaptureSource {
  if (
    source === 'share_sheet' ||
    source === 'paste' ||
    source === 'sms_manual' ||
    source === 'email_forward' ||
    source === 'android_notification'
  ) {
    return source;
  }
  return 'paste';
}

export function parseCaptureText(rawText: string): Record<string, unknown> {
  const amountMatch = rawText.match(/(?:INR|Rs\.?|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  const utrMatch = rawText.match(/\b(?:UTR|UPI Ref(?:erence)?|Ref(?:erence)?)[:\s-]*([A-Z0-9]{6,})\b/i);
  const dateMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2})\b/);
  return {
    amountMinor: amountMatch ? decimalTextToMinor(amountMatch[1]) : undefined,
    currencyCode: amountMatch ? 'INR' : undefined,
    reference: utrMatch?.[1],
    date: dateMatch?.[1],
    confidence: [amountMatch, utrMatch, dateMatch].filter(Boolean).length / 3,
    needsReview: true
  };
}

function decimalTextToMinor(value: string): number {
  const normalized = value.replace(/,/g, '');
  const [major, minor = ''] = normalized.split('.');
  return Number.parseInt(major, 10) * 100 + Number.parseInt(minor.padEnd(2, '0').slice(0, 2) || '0', 10);
}

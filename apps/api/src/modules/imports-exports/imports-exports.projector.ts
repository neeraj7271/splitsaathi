import type { DomainEvent, Projector } from '../ledger';
import type { ExportJobRow, ImportItemRow, ImportJobRow } from './imports-exports.types';

function cloneImportJob(job: ImportJobRow): ImportJobRow {
  return {
    ...job,
    items: job.items.map((item) => ({
      ...item,
      raw: { ...item.raw },
      expenseCommand: item.expenseCommand
        ? {
            ...item.expenseCommand,
            payers: item.expenseCommand.payers.map((payer) => ({ ...payer })),
            shares: item.expenseCommand.shares.map((share) => ({ ...share })),
            lineItems: item.expenseCommand.lineItems?.map((line) => ({
              ...line,
              participantIds: [...line.participantIds]
            })),
            billAdjustments: item.expenseCommand.billAdjustments?.map((adjustment) => ({ ...adjustment }))
          }
        : undefined
    }))
  };
}

export class ImportsExportsProjector implements Projector {
  readonly name = 'imports_exports_projection';

  private readonly importJobs = new Map<string, ImportJobRow>();
  private readonly exportJobs = new Map<string, ExportJobRow>();

  apply(event: DomainEvent): void {
    if (event.type === 'ImportJobCreated') {
      const payload = event.payload as {
        importJobId: string;
        groupId: string;
        items: ImportItemRow[];
      };
      this.importJobs.set(payload.importJobId, {
        importJobId: payload.importJobId,
        groupId: payload.groupId,
        status: 'parsed',
        createdBy: event.actorId ?? 'system',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        items: payload.items.map((item) => ({ ...item, raw: { ...item.raw } }))
      });
      return;
    }

    if (event.type === 'ImportItemCommitted') {
      const payload = event.payload as {
        importJobId: string;
        itemId: string;
        expenseId?: string;
        error?: string;
      };
      const job = this.importJobs.get(payload.importJobId);
      if (!job) {
        throw new Error(`Cannot project import item for missing job ${payload.importJobId}.`);
      }
      const item = job.items.find((candidate) => candidate.itemId === payload.itemId);
      if (!item) {
        throw new Error(`Cannot project missing import item ${payload.itemId}.`);
      }
      item.status = payload.error ? 'failed' : 'committed';
      item.error = payload.error;
      item.committedExpenseId = payload.expenseId;
      job.status = job.items.some((candidate) => candidate.status === 'failed') ? 'failed' : 'committed';
      job.updatedAt = event.occurredAt;
      return;
    }

    if (event.type === 'ExportJobCreated') {
      const payload = event.payload as ExportJobRow;
      this.exportJobs.set(payload.exportJobId, {
        ...payload,
        createdBy: event.actorId ?? payload.createdBy,
        createdAt: event.occurredAt
      });
    }
  }

  getImportJob(importJobId: string): ImportJobRow | undefined {
    const job = this.importJobs.get(importJobId);
    return job ? cloneImportJob(job) : undefined;
  }

  getExportJob(exportJobId: string): ExportJobRow | undefined {
    const job = this.exportJobs.get(exportJobId);
    return job ? { ...job } : undefined;
  }

  reset(): void {
    this.importJobs.clear();
    this.exportJobs.clear();
  }
}

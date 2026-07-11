import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { ImportsExportsProjector } from '../imports-exports';
import type { DomainEvent } from '../ledger';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { RecurringProjector } from '../recurring';
import { SettlementProjector } from '../settlements';
import { OfflineCommandSyncService } from './offline-command-sync.service';
import type { OfflineCommand, OfflineCommandBatchRequest } from './offline-sync.types';

@ApiTags('offline-sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OfflineSyncController {
  constructor(
    private readonly syncService: OfflineCommandSyncService,
    private readonly settlements: SettlementProjector,
    private readonly importsExports: ImportsExportsProjector,
    private readonly recurring: RecurringProjector,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Post('commands/batch')
  async executeBatch(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() request: OfflineCommandBatchRequest
  ): ReturnType<OfflineCommandSyncService['executeBatch']> {
    const enrichedRequest: OfflineCommandBatchRequest = {
      ...request,
      commands: request.commands.map((command) => this.enrichCommand(currentUser.userId, command))
    };

    for (const command of enrichedRequest.commands) {
      await this.assertCommandAllowed(currentUser.userId, command);
    }
    const response = await this.syncService.executeBatch(enrichedRequest);
    return {
      ...response,
      events: await this.filterReadableEvents(currentUser.userId, response.events as DomainEvent[])
    };
  }

  @Get('sync')
  async sync(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('cursor') cursor?: string
  ): ReturnType<OfflineCommandSyncService['sync']> {
    const response = await this.syncService.sync(cursor ? Number.parseInt(cursor, 10) : 0);
    return {
      ...response,
      events: await this.filterReadableEvents(currentUser.userId, response.events as DomainEvent[])
    };
  }

  private async assertCommandAllowed(userId: string, command: OfflineCommand): Promise<void> {
    const payload = command.payload as unknown as Record<string, unknown>;
    switch (command.commandType) {
      case 'expense.create':
      case 'expense.revise':
      case 'import.splitwiseCsv':
      case 'recurring.createSchedule':
        await this.authorization.assertCan(userId, String(payload.groupId), 'expense.create');
        return;
      case 'expense.void':
        await this.authorization.assertCan(userId, String(payload.groupId), 'expense.void');
        return;
      case 'settlement.createIntent':
        await this.authorization.assertCan(userId, String(payload.groupId), 'settlement.confirm');
        return;
      case 'settlement.upiOpened':
      case 'settlement.submitProof':
      case 'settlement.confirm':
      case 'settlement.reject':
      case 'settlement.dispute':
      case 'settlement.reverse':
      case 'settlement.refund': {
        const intent = this.settlements.getIntent(String(payload.settlementIntentId));
        if (intent) {
          await this.authorization.assertCan(userId, intent.groupId, 'settlement.confirm');
        }
        return;
      }
      case 'import.commit': {
        const job = this.importsExports.getImportJob(String(payload.importJobId));
        if (job) {
          await this.authorization.assertCan(userId, job.groupId, 'expense.create');
        }
        return;
      }
      case 'export.create':
        await this.authorization.assertCan(userId, String(payload.groupId), 'export');
        return;
      case 'recurring.generateDue':
        for (const schedule of this.recurring.listActiveSchedules()) {
          await this.authorization.assertCan(userId, schedule.groupId, 'expense.create');
        }
        return;
    }
  }

  private enrichCommand(userId: string, command: OfflineCommand): OfflineCommand {
    const expectedAggregateVersion = (command as OfflineCommand & { expectedAggregateVersion?: number })
      .expectedAggregateVersion;
    const payload: Record<string, unknown> = {
      ...(command.payload as unknown as Record<string, unknown>),
      actorId: userId,
      idempotencyKey: command.idempotencyKey
    };

    // Mobile queues carry a transport-level expectedAggregateVersion so the
    // same envelope can be reused for different command types. Command
    // handlers still consume the domain-level expectedVersion field.
    if (expectedAggregateVersion !== undefined && payload.expectedVersion === undefined) {
      payload.expectedVersion = expectedAggregateVersion;
    }

    return {
      ...command,
      payload: payload as unknown as OfflineCommand['payload']
    };
  }

  private async filterReadableEvents(userId: string, events: DomainEvent[]): Promise<DomainEvent[]> {
    const readableGroupIds = await this.authorization.listReadableGroupIds(userId);
    if (!readableGroupIds) {
      return events;
    }
    const readable = new Set(readableGroupIds);
    return events.filter((event) => event.groupId && readable.has(event.groupId));
  }
}

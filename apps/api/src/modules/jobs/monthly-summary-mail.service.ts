import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import { In, Repository } from 'typeorm';
import { EMAIL_PROVIDER } from '../auth/auth.constants';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { EmailCredentialEntity } from '../auth/entities/email-credential.entity';
import type { EmailProviderPort } from '../auth/ports/email-provider.port';
import { GroupMembershipEntity } from '../groups/entities/group-membership.entity';
import { GroupEntity } from '../groups/entities/group.entity';
import { ParticipantEntity } from '../groups/entities/participant.entity';
import { BalanceProjector } from '../ledger/balance.projector';
import { UserPreferencesEntity } from '../users/entities/user-preferences.entity';
import { buildMonthlySummaryExcel } from './monthly-summary-mail.excel';
import {
  consolidatedMonthlySummarySubject,
  formatConsolidatedMonthlySummaryHtml,
  formatConsolidatedMonthlySummaryTextInbox,
  formatMonthlySummaryHtml,
  formatMonthlySummaryTextInbox,
  monthlySummarySubject,
  type GroupSummarySlice,
  type MonthlySummaryRecipientContext
} from './monthly-summary-mail.template';

export interface MonthlySummaryJobResult {
  groupsProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  skipped: number;
  testEmail?: string;
}

interface SendUserSummaryOptions {
  bypassPreference?: boolean;
}

@Injectable()
export class MonthlySummaryMailService {
  private readonly logger = new Logger(MonthlySummaryMailService.name);
  private readonly settlementOptimizer = new GreedySettlementOptimizer();

  constructor(
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly memberships: Repository<GroupMembershipEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participants: Repository<ParticipantEntity>,
    @InjectRepository(UserPreferencesEntity)
    private readonly preferences: Repository<UserPreferencesEntity>,
    @InjectRepository(EmailCredentialEntity)
    private readonly emailCredentials: Repository<EmailCredentialEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    private readonly balances: BalanceProjector,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProviderPort
  ) {}

  /**
   * One consolidated email per member across all active groups (Excel attachment when 2+ groups).
   */
  async sendMonthlySettlementSummaries(): Promise<MonthlySummaryJobResult> {
    const activeGroups = await this.groups.find({ where: { state: 'active' } });
    const summariesByUser = await this.collectSummariesByUser(activeGroups);

    let emailsSent = 0;
    let emailsFailed = 0;
    let skipped = 0;

    for (const [userId, slices] of summariesByUser) {
      const outcome = await this.sendConsolidatedSummary(userId, slices);
      if (outcome === 'sent') {
        emailsSent += 1;
      } else if (outcome === 'failed') {
        emailsFailed += 1;
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Monthly settlement summaries: groups=${activeGroups.length} users=${summariesByUser.size} sent=${emailsSent} failed=${emailsFailed} skipped=${skipped}`
    );

    return {
      groupsProcessed: activeGroups.length,
      emailsSent,
      emailsFailed,
      skipped
    };
  }

  /** Smoke test: one consolidated email for a single address. */
  async sendForUserEmail(email: string): Promise<MonthlySummaryJobResult> {
    const normalized = email.trim().toLowerCase();
    const userId = await this.resolveUserIdByEmail(normalized);
    if (!userId) {
      throw new NotFoundException(`No account with verified email: ${normalized}`);
    }

    const activeGroups = await this.groups.find({ where: { state: 'active' } });
    const summariesByUser = await this.collectSummariesByUser(activeGroups, userId);
    const slices = summariesByUser.get(userId) ?? [];

    if (slices.length === 0) {
      return {
        groupsProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0,
        skipped: 0,
        testEmail: normalized
      };
    }

    const outcome = await this.sendConsolidatedSummary(userId, slices, { bypassPreference: true });

    return {
      groupsProcessed: slices.length,
      emailsSent: outcome === 'sent' ? 1 : 0,
      emailsFailed: outcome === 'failed' ? 1 : 0,
      skipped: outcome === 'skipped' ? 1 : 0,
      testEmail: normalized
    };
  }

  private async collectSummariesByUser(
    activeGroups: GroupEntity[],
    onlyUserId?: string
  ): Promise<Map<string, GroupSummarySlice[]>> {
    const byUser = new Map<string, Map<string, GroupSummarySlice>>();

    for (const group of activeGroups) {
      const memberships = await this.memberships.find({
        where: {
          groupId: group.id,
          status: In(['active', 'locked_for_exit']),
          ...(onlyUserId ? { userId: onlyUserId } : {})
        }
      });
      if (memberships.length === 0) {
        continue;
      }

      const participants = await this.participants.find({ where: { groupId: group.id } });
      const nameByParticipantId = new Map(participants.map((row) => [row.id, row.displayName]));
      const balanceRows = this.balances.listGroupBalances(group.id, { includeZero: true });
      const settlements = this.settlementOptimizer.suggest(
        balanceRows.map((row) => ({
          participantId: row.participantId,
          amountMinor: row.amountMinor,
          currencyCode: row.currencyCode
        }))
      );

      const seenUserIds = new Set<string>();
      for (const membership of memberships) {
        if (!membership.userId || seenUserIds.has(membership.userId)) {
          continue;
        }
        seenUserIds.add(membership.userId);

        const slice: GroupSummarySlice = {
          group: { id: group.id, name: group.name, baseCurrencyCode: group.baseCurrencyCode },
          balanceRows,
          settlements,
          nameByParticipantId,
          recipient: this.resolveRecipientContext(membership, participants)
        };

        if (!byUser.has(membership.userId)) {
          byUser.set(membership.userId, new Map());
        }
        byUser.get(membership.userId)!.set(group.id, slice);
      }
    }

    const result = new Map<string, GroupSummarySlice[]>();
    for (const [userId, groupMap] of byUser) {
      result.set(
        userId,
        [...groupMap.values()].sort((left, right) => left.group.name.localeCompare(right.group.name))
      );
    }
    return result;
  }

  private async sendConsolidatedSummary(
    userId: string,
    slices: GroupSummarySlice[],
    options: SendUserSummaryOptions = {}
  ): Promise<'sent' | 'failed' | 'skipped'> {
    if (slices.length === 0) {
      return 'skipped';
    }

    if (!options.bypassPreference) {
      const prefs = await this.preferences.findOne({ where: { userId } });
      if (prefs && prefs.emailMonthlySummary === false) {
        return 'skipped';
      }
    }

    const to = await this.resolveEmail(userId);
    if (!to) {
      return 'skipped';
    }

    const subject =
      slices.length === 1
        ? monthlySummarySubject(slices[0]!.group.name)
        : consolidatedMonthlySummarySubject(slices.length);
    const text =
      slices.length === 1
        ? formatMonthlySummaryTextInbox(slices[0]!.group, slices[0]!.balanceRows, slices[0]!.recipient)
        : formatConsolidatedMonthlySummaryTextInbox(slices);
    const html =
      slices.length === 1
        ? formatMonthlySummaryHtml(
            slices[0]!.group,
            slices[0]!.balanceRows,
            slices[0]!.nameByParticipantId,
            slices[0]!.settlements,
            slices[0]!.recipient
          )
        : formatConsolidatedMonthlySummaryHtml(slices);
    const attachments =
      slices.length > 1
        ? [buildMonthlySummaryExcel(slices)]
        : undefined;

    try {
      const delivery = await this.emailProvider.send({
        to,
        subject,
        text,
        html,
        attachments
      });
      this.logger.log(
        `Monthly summary sent via ${delivery.deliveryMode} to=${to} groups=${slices.length} user=${userId}`
      );
      return 'sent';
    } catch (error) {
      this.logger.error(
        `Monthly summary failed for user=${userId} to=${to}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 'failed';
    }
  }

  private resolveRecipientContext(
    membership: GroupMembershipEntity,
    participants: ParticipantEntity[]
  ): MonthlySummaryRecipientContext | undefined {
    const participant =
      (membership.participantId
        ? participants.find((row) => row.id === membership.participantId)
        : undefined) ??
      participants.find((row) => row.linkedUserId === membership.userId);

    if (!participant) {
      return undefined;
    }

    return {
      displayName: participant.displayName,
      participantId: participant.id
    };
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    const credential = await this.emailCredentials.findOne({ where: { userId } });
    if (credential?.verifiedAt && credential.email) {
      return credential.email;
    }
    const emailIdentity = await this.identities.findOne({ where: { userId, provider: 'email' } });
    return emailIdentity?.identifier ?? null;
  }

  private async resolveUserIdByEmail(email: string): Promise<string | null> {
    const credential = await this.emailCredentials.findOne({ where: { email } });
    if (credential?.verifiedAt) {
      return credential.userId;
    }

    const emailIdentity = await this.identities.findOne({
      where: { provider: 'email', identifier: email }
    });
    return emailIdentity?.userId ?? null;
  }
}

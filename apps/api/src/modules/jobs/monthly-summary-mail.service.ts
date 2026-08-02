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
import {
  formatMonthlySummaryHtml,
  formatMonthlySummaryTextInbox,
  monthlySummarySubject,
  type MonthlySummaryRecipientContext
} from './monthly-summary-mail.template';

export interface MonthlySummaryJobResult {
  groupsProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  skipped: number;
  testEmail?: string;
}

interface SendMembershipOptions {
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
   * Builds per-group balance summaries and emails members who opted into
   * `emailMonthlySummary` and have a verified email (password credential or Google email identity).
   */
  async sendMonthlySettlementSummaries(): Promise<MonthlySummaryJobResult> {
    const activeGroups = await this.groups.find({ where: { state: 'active' } });
    let emailsSent = 0;
    let emailsFailed = 0;
    let skipped = 0;

    for (const group of activeGroups) {
      const outcome = await this.sendSummariesForGroup(group);
      emailsSent += outcome.emailsSent;
      emailsFailed += outcome.emailsFailed;
      skipped += outcome.skipped;
    }

    this.logger.log(
      `Monthly settlement summaries: groups=${activeGroups.length} sent=${emailsSent} failed=${emailsFailed} skipped=${skipped}`
    );

    return {
      groupsProcessed: activeGroups.length,
      emailsSent,
      emailsFailed,
      skipped
    };
  }

  /**
   * Smoke test: send real monthly summaries for one verified email across their active groups.
   * Ignores the monthly-summary opt-out so operators can verify delivery.
   */
  async sendForUserEmail(email: string): Promise<MonthlySummaryJobResult> {
    const normalized = email.trim().toLowerCase();
    const userId = await this.resolveUserIdByEmail(normalized);
    if (!userId) {
      throw new NotFoundException(`No account with verified email: ${normalized}`);
    }

    const to = await this.resolveEmail(userId);
    if (!to) {
      throw new NotFoundException(`Could not resolve deliverable email for user ${userId}`);
    }

    const memberships = await this.memberships.find({
      where: { userId, status: In(['active', 'locked_for_exit']) }
    });
    const activeGroups = await this.groups.find({ where: { state: 'active' } });
    const activeGroupById = new Map(activeGroups.map((group) => [group.id, group]));

    let emailsSent = 0;
    let emailsFailed = 0;
    let skipped = 0;
    let groupsProcessed = 0;
    const emailedGroupIds = new Set<string>();

    for (const membership of memberships) {
      const group = activeGroupById.get(membership.groupId);
      if (!group) {
        skipped += 1;
        continue;
      }
      if (emailedGroupIds.has(group.id)) {
        skipped += 1;
        continue;
      }

      groupsProcessed += 1;
      const outcome = await this.sendSummaryForMembership(group, membership, to, {
        bypassPreference: true
      });
      if (outcome === 'sent') {
        emailedGroupIds.add(group.id);
        emailsSent += 1;
      } else if (outcome === 'failed') {
        emailsFailed += 1;
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Monthly settlement test for ${normalized}: groups=${groupsProcessed} sent=${emailsSent} failed=${emailsFailed} skipped=${skipped}`
    );

    return {
      groupsProcessed,
      emailsSent,
      emailsFailed,
      skipped,
      testEmail: normalized
    };
  }

  private async sendSummariesForGroup(group: GroupEntity): Promise<{
    emailsSent: number;
    emailsFailed: number;
    skipped: number;
  }> {
    const memberships = await this.memberships.find({
      where: { groupId: group.id, status: In(['active', 'locked_for_exit']) }
    });
    const participants = await this.participants.find({ where: { groupId: group.id } });
    const emailedUserIds = new Set<string>();

    let emailsSent = 0;
    let emailsFailed = 0;
    let skipped = 0;

    for (const membership of memberships) {
      if (!membership.userId) {
        skipped += 1;
        continue;
      }

      if (emailedUserIds.has(membership.userId)) {
        skipped += 1;
        continue;
      }

      const to = await this.resolveEmail(membership.userId);
      if (!to) {
        skipped += 1;
        continue;
      }

      const outcome = await this.sendSummaryForMembership(group, membership, to);
      if (outcome === 'sent') {
        emailedUserIds.add(membership.userId);
        emailsSent += 1;
      } else if (outcome === 'failed') {
        emailsFailed += 1;
      } else {
        skipped += 1;
      }
    }

    return { emailsSent, emailsFailed, skipped };
  }

  private async sendSummaryForMembership(
    group: GroupEntity,
    membership: GroupMembershipEntity,
    to: string,
    options: SendMembershipOptions = {}
  ): Promise<'sent' | 'failed' | 'skipped'> {
    if (!membership.userId) {
      return 'skipped';
    }

    if (!options.bypassPreference) {
      const prefs = await this.preferences.findOne({ where: { userId: membership.userId } });
      if (prefs && prefs.emailMonthlySummary === false) {
        return 'skipped';
      }
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
    const recipient = this.resolveRecipientContext(membership, participants);
    const summaryText = formatMonthlySummaryTextInbox(group, balanceRows, recipient);
    const summaryHtml = formatMonthlySummaryHtml(
      group,
      balanceRows,
      nameByParticipantId,
      settlements,
      recipient
    );

    try {
      await this.emailProvider.send({
        to,
        subject: monthlySummarySubject(group.name),
        text: summaryText,
        html: summaryHtml
      });
      return 'sent';
    } catch (error) {
      this.logger.error(
        `Monthly summary failed for user=${membership.userId} group=${group.id} to=${to}: ${
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

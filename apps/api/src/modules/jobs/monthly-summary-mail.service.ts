import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

export interface MonthlySummaryJobResult {
  groupsProcessed: number;
  emailsSent: number;
  skipped: number;
}

@Injectable()
export class MonthlySummaryMailService {
  private readonly logger = new Logger(MonthlySummaryMailService.name);

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
    let skipped = 0;

    for (const group of activeGroups) {
      const memberships = await this.memberships.find({
        where: { groupId: group.id, status: In(['active', 'locked_for_exit']) }
      });
      const participants = await this.participants.find({ where: { groupId: group.id } });
      const nameByParticipantId = new Map(participants.map((row) => [row.id, row.displayName]));
      const balanceRows = this.balances.listGroupBalances(group.id, { includeZero: true });
      const summaryBody = this.formatGroupSummary(group, balanceRows, nameByParticipantId);

      for (const membership of memberships) {
        if (!membership.userId) {
          skipped += 1;
          continue;
        }

        const prefs = await this.preferences.findOne({ where: { userId: membership.userId } });
        if (prefs && prefs.emailMonthlySummary === false) {
          skipped += 1;
          continue;
        }

        const to = await this.resolveEmail(membership.userId);
        if (!to) {
          skipped += 1;
          continue;
        }

        await this.emailProvider.send({
          to,
          subject: `SplitSaathi monthly summary — ${group.name}`,
          text: summaryBody
        });
        emailsSent += 1;
      }
    }

    this.logger.log(
      `Monthly settlement summaries: groups=${activeGroups.length} sent=${emailsSent} skipped=${skipped}`
    );

    return {
      groupsProcessed: activeGroups.length,
      emailsSent,
      skipped
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

  private formatGroupSummary(
    group: GroupEntity,
    balanceRows: ReturnType<BalanceProjector['listGroupBalances']>,
    nameByParticipantId: Map<string, string>
  ): string {
    const monthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const lines = [
      `Monthly settlement summary for ${group.name} (${monthLabel})`,
      `Base currency: ${group.baseCurrencyCode}`,
      ''
    ];

    if (balanceRows.length === 0) {
      lines.push('No projected balances yet for this group.');
    } else {
      lines.push('Balances:');
      for (const row of balanceRows) {
        const name = nameByParticipantId.get(row.participantId) ?? row.participantId;
        if (row.amountMinor === 0) {
          lines.push(`- ${name}: Settled (${row.currencyCode})`);
          continue;
        }
        const amount = (Math.abs(row.amountMinor) / 100).toFixed(2);
        const direction = row.amountMinor > 0 ? 'is owed' : 'owes';
        lines.push(`- ${name}: ${direction} ${amount} ${row.currencyCode}`);
      }
    }

    lines.push('', 'You can manage this email in SplitSaathi notification settings.');
    return lines.join('\n');
  }
}

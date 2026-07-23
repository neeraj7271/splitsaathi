import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import { In, Repository } from 'typeorm';
import { BalanceProjector } from '../ledger/balance.projector';
import { ExpenseProjector } from '../ledger/expense.projector';
import { SettlementProjector } from '../settlements/settlement.projector';
import { NotificationsService } from '../notifications/notifications.service';
import { GroupMembershipEntity } from '../groups/entities/group-membership.entity';
import { GroupEntity } from '../groups/entities/group.entity';
import { ParticipantEntity } from '../groups/entities/participant.entity';
import { UsersService } from '../users/users.service';
import {
  FriendDetailDto,
  FriendSharedGroupDto,
  FriendSummaryDto,
  FriendTransactionDto,
  RemindFriendResponseDto,
  type FriendBalanceStatus
} from './dto/friend-response.dto';

type SharedGroupPair = {
  group: GroupEntity;
  myParticipantId: string;
  theirParticipantId: string;
};

@Injectable()
export class FriendsService {
  private readonly optimizer = new GreedySettlementOptimizer();

  constructor(
    @InjectRepository(GroupMembershipEntity)
    private readonly memberships: Repository<GroupMembershipEntity>,
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participants: Repository<ParticipantEntity>,
    private readonly balances: BalanceProjector,
    private readonly expenses: ExpenseProjector,
    private readonly settlements: SettlementProjector,
    private readonly users: UsersService,
    @Optional() private readonly notifications?: NotificationsService
  ) {}

  async listFriends(userId: string): Promise<FriendSummaryDto[]> {
    const pairsByFriend = await this.sharedPairsByFriend(userId);
    const summaries: FriendSummaryDto[] = [];

    for (const [otherUserId, pairs] of pairsByFriend.entries()) {
      summaries.push(await this.buildSummary(userId, otherUserId, pairs));
    }

    return summaries.sort((a, b) => {
      const rank = (status: FriendBalanceStatus) =>
        status === 'owes_you' ? 0 : status === 'you_owe' ? 1 : status === 'settled' ? 2 : 3;
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) {
        return byStatus;
      }
      return Math.abs(b.netMinor) - Math.abs(a.netMinor);
    });
  }

  async getFriendDetail(userId: string, otherUserId: string): Promise<FriendDetailDto> {
    const pairsByFriend = await this.sharedPairsByFriend(userId);
    const pairs = pairsByFriend.get(otherUserId);
    if (!pairs?.length) {
      throw new NotFoundException('Friend not found. You only see people from shared groups.');
    }
    const friend = await this.buildSummary(userId, otherUserId, pairs);
    const transactions = await this.listTransactions(userId, otherUserId, pairs);
    return { friend, transactions };
  }

  async remindFriend(userId: string, otherUserId: string): Promise<RemindFriendResponseDto> {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot remind yourself.');
    }
    if (!this.notifications) {
      throw new ForbiddenException('Notifications are unavailable.');
    }

    const detail = await this.getFriendDetail(userId, otherUserId);
    if (detail.friend.netMinor <= 0) {
      throw new BadRequestException('Reminders are only for friends who currently owe you.');
    }

    const me = await this.users.findByIdOrThrow(userId);
    const amount = (detail.friend.netMinor / 100).toFixed(2);
    const groupHint =
      detail.friend.sharedGroups.length === 1
        ? detail.friend.sharedGroups[0].groupName
        : `${detail.friend.sharedGroupCount} shared groups`;
    const notification = await this.notifications.create({
      userId: otherUserId,
      type: 'friend_payment_reminder',
      title: 'Settlement reminder',
      body: `${me.displayName} reminded you about ₹${amount} (${groupHint}).`,
      tone: 'action_required',
      data: {
        fromUserId: userId,
        netMinor: detail.friend.netMinor,
        currencyCode: detail.friend.currencyCode,
        sharedGroupIds: detail.friend.sharedGroups.map((row) => row.groupId)
      }
    });

    return { notificationId: notification.id, delivered: true };
  }

  private async sharedPairsByFriend(userId: string): Promise<Map<string, SharedGroupPair[]>> {
    const myMemberships = await this.memberships.find({
      where: { userId, status: In(['active', 'locked_for_exit']) }
    });
    const map = new Map<string, SharedGroupPair[]>();
    if (!myMemberships.length) {
      return map;
    }

    const groupIds = [...new Set(myMemberships.map((row) => row.groupId))];
    const [groups, allMemberships, allParticipants] = await Promise.all([
      this.groups.find({ where: { id: In(groupIds) } }),
      this.memberships.find({
        where: { groupId: In(groupIds), status: In(['active', 'locked_for_exit']) }
      }),
      this.participants.find({ where: { groupId: In(groupIds) } })
    ]);
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const myParticipantByGroup = new Map(
      myMemberships.map((row) => [row.groupId, row.participantId])
    );

    for (const membership of allMemberships) {
      if (!membership.userId || membership.userId === userId) {
        continue;
      }
      const group = groupById.get(membership.groupId);
      const myParticipantId = myParticipantByGroup.get(membership.groupId);
      if (!group || !myParticipantId || !membership.participantId || group.state === 'archived') {
        continue;
      }
      // Prefer membership participant; fall back to linked participant for same user.
      let theirParticipantId = membership.participantId;
      const linked = allParticipants.find(
        (row) => row.groupId === membership.groupId && row.linkedUserId === membership.userId
      );
      if (linked) {
        theirParticipantId = linked.id;
      }
      const list = map.get(membership.userId) ?? [];
      if (!list.some((row) => row.group.id === group.id)) {
        list.push({ group, myParticipantId, theirParticipantId });
        map.set(membership.userId, list);
      }
    }

    return map;
  }

  private async buildSummary(
    userId: string,
    otherUserId: string,
    pairs: SharedGroupPair[]
  ): Promise<FriendSummaryDto> {
    const other = await this.users.findByIdOrThrow(otherUserId);
    const currencyCode = pairs[0]?.group.baseCurrencyCode ?? 'INR';
    const sharedGroups: FriendSharedGroupDto[] = [];
    let netMinor = 0;
    let hasHistory = false;

    for (const pair of pairs) {
      const pairNet = this.pairNetInGroup(pair);
      const history = this.hasPairHistory(pair);
      hasHistory = hasHistory || history;
      netMinor += pairNet;
      sharedGroups.push({
        groupId: pair.group.id,
        groupName: pair.group.name,
        pairNetMinor: pairNet,
        currencyCode: pair.group.baseCurrencyCode || currencyCode
      });
    }

    return {
      otherUserId,
      displayName: other.displayName,
      avatarUrl: other.avatarAttachmentId ? `/v1/public/avatars/${other.avatarAttachmentId}` : null,
      currencyCode,
      netMinor,
      status: this.statusFor(netMinor, hasHistory),
      sharedGroupCount: pairs.length,
      sharedGroups
    };
  }

  private pairNetInGroup(pair: SharedGroupPair): number {
    const currencyCode = pair.group.baseCurrencyCode || 'INR';
    const rows = this.balances
      .listGroupBalances(pair.group.id)
      .filter((row) => row.currencyCode === currencyCode)
      .map((row) => ({
        participantId: row.participantId,
        amountMinor: row.amountMinor,
        currencyCode: row.currencyCode
      }));

    // Two-person group: my balance is exactly the pairwise net.
    const memberCount = new Set(rows.map((row) => row.participantId)).size;
    if (memberCount <= 2) {
      return (
        rows.find((row) => row.participantId === pair.myParticipantId)?.amountMinor ?? 0
      );
    }

    const suggestions = this.optimizer.suggest(rows);
    const edge = suggestions.find(
      (row) =>
        (row.payerParticipantId === pair.myParticipantId &&
          row.payeeParticipantId === pair.theirParticipantId) ||
        (row.payerParticipantId === pair.theirParticipantId &&
          row.payeeParticipantId === pair.myParticipantId)
    );
    if (!edge) {
      return 0;
    }
    // Positive => friend owes me (I am payee).
    return edge.payeeParticipantId === pair.myParticipantId ? edge.amountMinor : -edge.amountMinor;
  }

  private hasPairHistory(pair: SharedGroupPair): boolean {
    const expenses = this.expenses.listGroupExpenses(pair.group.id);
    for (const expense of expenses) {
      if (expense.status === 'voided') {
        continue;
      }
      const ids = new Set<string>([
        ...expense.payers.map((row) => row.participantId),
        ...expense.shares.map((row) => row.participantId)
      ]);
      if (ids.has(pair.myParticipantId) && ids.has(pair.theirParticipantId)) {
        return true;
      }
    }

    const intents = this.settlements.listGroupIntents(pair.group.id);
    return intents.some(
      (intent) =>
        (intent.payerParticipantId === pair.myParticipantId &&
          intent.payeeParticipantId === pair.theirParticipantId) ||
        (intent.payerParticipantId === pair.theirParticipantId &&
          intent.payeeParticipantId === pair.myParticipantId)
    );
  }

  private statusFor(netMinor: number, hasHistory: boolean): FriendBalanceStatus {
    if (!hasHistory && netMinor === 0) {
      return 'no_expenses';
    }
    if (netMinor > 0) {
      return 'owes_you';
    }
    if (netMinor < 0) {
      return 'you_owe';
    }
    return 'settled';
  }

  private async listTransactions(
    userId: string,
    otherUserId: string,
    pairs: SharedGroupPair[]
  ): Promise<FriendTransactionDto[]> {
    const rows: FriendTransactionDto[] = [];

    for (const pair of pairs) {
      const currencyCode = pair.group.baseCurrencyCode || 'INR';
      for (const expense of this.expenses.listGroupExpenses(pair.group.id)) {
        if (expense.status === 'voided') {
          continue;
        }
        const payerIds = new Set(expense.payers.map((row) => row.participantId));
        const shareIds = new Set(expense.shares.map((row) => row.participantId));
        const involvesBoth =
          (payerIds.has(pair.myParticipantId) || shareIds.has(pair.myParticipantId)) &&
          (payerIds.has(pair.theirParticipantId) || shareIds.has(pair.theirParticipantId));
        if (!involvesBoth) {
          continue;
        }

        const iPaid = expense.payers
          .filter((row) => row.participantId === pair.myParticipantId)
          .reduce((sum, row) => sum + row.amountMinor, 0);
        const theyPaid = expense.payers
          .filter((row) => row.participantId === pair.theirParticipantId)
          .reduce((sum, row) => sum + row.amountMinor, 0);
        const myShare = expense.shares
          .filter((row) => row.participantId === pair.myParticipantId)
          .reduce((sum, row) => sum + row.amountMinor, 0);
        const theirShare = expense.shares
          .filter((row) => row.participantId === pair.theirParticipantId)
          .reduce((sum, row) => sum + row.amountMinor, 0);

        // Pairwise display amount (halved group-leg difference works for 2-person; soft estimate otherwise).
        const amountMinor = Math.round(((iPaid - myShare) - (theyPaid - theirShare)) / 2);
        if (amountMinor === 0) {
          continue;
        }

        rows.push({
          id: `expense:${expense.expenseId}`,
          kind: 'expense',
          groupId: pair.group.id,
          groupName: pair.group.name,
          occurredAt: expense.expenseDate || expense.createdAt,
          description: expense.description,
          amountMinor,
          currencyCode,
          expenseId: expense.expenseId
        });
      }

      for (const intent of this.settlements.listGroupIntents(pair.group.id)) {
        const betweenUs =
          (intent.payerParticipantId === pair.myParticipantId &&
            intent.payeeParticipantId === pair.theirParticipantId) ||
          (intent.payerParticipantId === pair.theirParticipantId &&
            intent.payeeParticipantId === pair.myParticipantId);
        if (!betweenUs) {
          continue;
        }
        if (!['ledger_posted', 'confirmed'].includes(intent.state)) {
          continue;
        }
        const amountMinor =
          intent.payerParticipantId === pair.myParticipantId ? intent.amountMinor : -intent.amountMinor;
        rows.push({
          id: `settlement:${intent.settlementIntentId}`,
          kind: 'settlement',
          groupId: pair.group.id,
          groupName: pair.group.name,
          occurredAt: intent.updatedAt ?? intent.createdAt,
          description: `Settlement · ${intent.paymentMethod}`,
          amountMinor,
          currencyCode,
          settlementIntentId: intent.settlementIntentId
        });
      }
    }

    return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}

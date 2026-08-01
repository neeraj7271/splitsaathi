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

  private friendIdentityKey(input: {
    userId?: string | null;
    linkedUserId?: string | null;
    phoneE164?: string | null;
    displayName: string;
    participantId: string;
  }): string {
    if (input.userId) {
      return input.userId;
    }
    if (input.linkedUserId) {
      return input.linkedUserId;
    }
    const phone = input.phoneE164?.trim();
    if (phone) {
      return `phone:${phone.replace(/[\s()-]/g, '')}`;
    }
    const name = input.displayName.trim().toLowerCase();
    if (name) {
      return `name:${name}`;
    }
    return input.participantId;
  }

  private collapseFriendMap(
    map: Map<string, SharedGroupPair[]>,
    participantById: Map<string, ParticipantEntity>
  ): Map<string, SharedGroupPair[]> {
    const aliasToCanonical = new Map<string, string>();

    const resolveKey = (key: string): string => {
      let current = key;
      const seen = new Set<string>();
      while (aliasToCanonical.has(current) && !seen.has(current)) {
        seen.add(current);
        current = aliasToCanonical.get(current)!;
      }
      return current;
    };

    const link = (from: string, to: string) => {
      const canonical = resolveKey(to);
      if (from !== canonical) {
        aliasToCanonical.set(from, canonical);
      }
    };

    for (const [key, pairs] of map.entries()) {
      for (const pair of pairs) {
        const participant = participantById.get(pair.theirParticipantId);
        if (participant?.linkedUserId) {
          link(key, participant.linkedUserId);
        }
      }
    }

    const nameToKey = new Map<string, string>();
    const phoneToKey = new Map<string, string>();

    for (const key of map.keys()) {
      const resolved = resolveKey(key);
      const pairs = map.get(key) ?? [];

      if (resolved.startsWith('name:')) {
        const norm = resolved.slice(5);
        if (nameToKey.has(norm)) {
          link(resolved, nameToKey.get(norm)!);
        } else {
          nameToKey.set(norm, resolved);
        }
        continue;
      }

      if (resolved.startsWith('phone:')) {
        const norm = resolved.slice(6);
        if (phoneToKey.has(norm)) {
          link(resolved, phoneToKey.get(norm)!);
        } else {
          phoneToKey.set(norm, resolved);
        }
        continue;
      }

      for (const pair of pairs) {
        const participant = participantById.get(pair.theirParticipantId);
        if (!participant) {
          continue;
        }
        const name = participant.displayName.trim().toLowerCase();
        if (name) {
          if (nameToKey.has(name)) {
            link(resolved, nameToKey.get(name)!);
          } else {
            nameToKey.set(name, resolved);
          }
        }
        const phone = participant.phoneE164?.trim().replace(/[\s()-]/g, '');
        if (phone) {
          if (phoneToKey.has(phone)) {
            link(resolved, phoneToKey.get(phone)!);
          } else {
            phoneToKey.set(phone, resolved);
          }
        }
      }
    }

    const merged = new Map<string, SharedGroupPair[]>();
    for (const [key, pairs] of map.entries()) {
      const canonical = resolveKey(key);
      const list = merged.get(canonical) ?? [];
      for (const pair of pairs) {
        if (!list.some((row) => row.group.id === pair.group.id)) {
          list.push(pair);
        }
      }
      merged.set(canonical, list);
    }

    return merged;
  }

  async getFriendDetail(userId: string, otherUserId: string): Promise<FriendDetailDto> {
    const pairsByFriend = await this.sharedPairsByFriend(userId);
    let pairs = pairsByFriend.get(otherUserId);
    let resolvedKey = otherUserId;

    if (!pairs?.length) {
      for (const [key, pList] of pairsByFriend.entries()) {
        if (pList.some((row) => row.theirParticipantId === otherUserId)) {
          pairs = pList;
          resolvedKey = key;
          break;
        }
      }
    }

    if (!pairs?.length) {
      throw new NotFoundException('Friend not found. You only see people from shared groups.');
    }
    const friend = await this.buildSummary(userId, resolvedKey, pairs);
    const transactions = await this.listTransactions(userId, resolvedKey, pairs);
    return { friend, transactions };
  }

  async remindFriend(userId: string, otherUserId: string): Promise<RemindFriendResponseDto> {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot remind yourself.');
    }
    if (!this.notifications) {
      throw new ForbiddenException('Notifications are unavailable.');
    }

    const targetUser = await this.users.findById(otherUserId);
    if (!targetUser) {
      throw new BadRequestException("This person hasn't registered an account on SplitSaathi yet. Share the invite link with them to join!");
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
    const [myMemberships, myParticipants] = await Promise.all([
      this.memberships.find({
        where: { userId, status: In(['active', 'locked_for_exit']) }
      }),
      this.participants.find({ where: { linkedUserId: userId } })
    ]);

    const myGroupIds = new Set<string>();
    const myParticipantByGroup = new Map<string, string>();

    for (const m of myMemberships) {
      myGroupIds.add(m.groupId);
      if (m.participantId) {
        myParticipantByGroup.set(m.groupId, m.participantId);
      }
    }
    for (const p of myParticipants) {
      myGroupIds.add(p.groupId);
      if (!myParticipantByGroup.has(p.groupId)) {
        myParticipantByGroup.set(p.groupId, p.id);
      }
    }

    const map = new Map<string, SharedGroupPair[]>();
    if (!myGroupIds.size) {
      return map;
    }

    const groupIdsArray = Array.from(myGroupIds);
    const [groups, allMemberships, allParticipants] = await Promise.all([
      this.groups.find({ where: { id: In(groupIdsArray) } }),
      this.memberships.find({
        where: { groupId: In(groupIdsArray), status: In(['active', 'locked_for_exit']) }
      }),
      this.participants.find({ where: { groupId: In(groupIdsArray) } })
    ]);
    const participantById = new Map(allParticipants.map((row) => [row.id, row]));

    for (const group of groups) {
      const groupMemberships = allMemberships.filter((m) => m.groupId === group.id);
      const groupParticipants = allParticipants.filter((p) => p.groupId === group.id);

      let myParticipantId = myParticipantByGroup.get(group.id);
      if (!myParticipantId) {
        const linkedP = groupParticipants.find((p) => p.linkedUserId === userId);
        if (linkedP) {
          myParticipantId = linkedP.id;
        } else {
          const myM = groupMemberships.find((m) => m.userId === userId);
          if (myM?.participantId) {
            myParticipantId = myM.participantId;
          }
        }
      }

      if (!myParticipantId) {
        continue;
      }

      const otherUserMap = new Map<string, string>();

      for (const m of groupMemberships) {
        if (m.userId && m.userId !== userId && m.participantId) {
          otherUserMap.set(m.userId, m.participantId);
        }
      }

      for (const p of groupParticipants) {
        if (p.id !== myParticipantId) {
          const targetKey = this.friendIdentityKey({
            linkedUserId: p.linkedUserId,
            phoneE164: p.phoneE164,
            displayName: p.displayName,
            participantId: p.id
          });
          if (targetKey !== userId) {
            if (!otherUserMap.has(targetKey)) {
              otherUserMap.set(targetKey, p.id);
            }
          }
        }
      }

      for (const [targetId, theirParticipantId] of otherUserMap.entries()) {
        const list = map.get(targetId) ?? [];
        if (!list.some((row) => row.group.id === group.id)) {
          list.push({ group, myParticipantId, theirParticipantId });
          map.set(targetId, list);
        }
      }
    }

    return this.collapseFriendMap(map, participantById);
  }

  private async buildSummary(
    userId: string,
    otherUserId: string,
    pairs: SharedGroupPair[]
  ): Promise<FriendSummaryDto> {
    let displayName = 'Friend';
    let avatarUrl: string | null = null;

    if (otherUserId.startsWith('phone:') || otherUserId.startsWith('name:')) {
      const participant = await this.participants.findOne({
        where: { id: pairs[0]?.theirParticipantId }
      });
      if (participant) {
        displayName = participant.displayName;
      }
    } else {
      const otherUser = await this.users.findById(otherUserId);
      if (otherUser) {
        displayName = otherUser.displayName;
        avatarUrl = otherUser.avatarAttachmentId ? `/v1/public/avatars/${otherUser.avatarAttachmentId}` : null;
      } else {
        const participant = await this.participants.findOne({ where: { id: otherUserId } });
        if (participant) {
          displayName = participant.displayName;
        }
      }
    }

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
        currencyCode: pair.group.baseCurrencyCode || currencyCode,
        groupType: pair.group.groupType || 'other',
        imageUrl: pair.group.imageAttachmentId
          ? `/v1/attachments/${pair.group.imageAttachmentId}/content`
          : null
      });
    }

    return {
      otherUserId,
      displayName,
      avatarUrl,
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

    if (!rows.length) {
      return 0;
    }

    const suggestions = this.optimizer.suggest(rows);
    const edge = suggestions.find(
      (row) =>
        (row.payerParticipantId === pair.myParticipantId &&
          row.payeeParticipantId === pair.theirParticipantId) ||
        (row.payerParticipantId === pair.theirParticipantId &&
          row.payeeParticipantId === pair.myParticipantId)
    );
    if (edge) {
      return edge.payeeParticipantId === pair.myParticipantId ? edge.amountMinor : -edge.amountMinor;
    }

    const idsInRows = new Set(rows.map((r) => r.participantId));
    if (idsInRows.has(pair.myParticipantId) && idsInRows.has(pair.theirParticipantId) && idsInRows.size === 2) {
      return rows.find((r) => r.participantId === pair.myParticipantId)?.amountMinor ?? 0;
    }

    return 0;
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

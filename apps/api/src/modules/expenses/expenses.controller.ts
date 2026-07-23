import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { GroupsService } from '../groups/groups.service';
import { ExpenseProjector } from '../ledger';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpenseCommandService } from './expense-command.service';
import type { CreateExpenseCommand, ReviseExpenseCommand, VoidExpenseCommand } from './expense.types';

function formatMinor(amountMinor: number, currencyCode: string): string {
  return `${currencyCode} ${(amountMinor / 100).toFixed(2)}`;
}

function explainExpense(expense: ReturnType<ExpenseProjector['getExpense']>) {
  if (!expense) {
    throw new NotFoundException('Expense not found.');
  }
  const splitTypes = [...new Set(expense.shares.map((share) => share.shareType))];
  const splitMethod = splitTypes.length === 1 ? splitTypes[0] : 'mixed';
  const paidBy = expense.payers.map((payer) => ({
    participantId: payer.participantId,
    amountMinor: payer.amountMinor,
    formattedAmount: formatMinor(payer.amountMinor, expense.currencyCode)
  }));
  const owedBy = expense.shares.map((share) => ({
    participantId: share.participantId,
    amountMinor: share.amountMinor,
    formattedAmount: formatMinor(share.amountMinor, expense.currencyCode),
    shareType: share.shareType,
    roundingDeltaMinor: share.roundingDeltaMinor
  }));
  const methodDetail =
    splitMethod === 'equal'
      ? `Split equally between ${owedBy.length} participants; any minor-unit remainder is recorded in each participant's rounding delta.`
      : splitMethod === 'exact'
        ? 'Each participant owes the exact amount recorded in the expense snapshot.'
        : splitMethod === 'weight'
          ? 'Each participant owes the deterministic weighted allocation recorded in the expense snapshot.'
          : splitMethod === 'itemized'
            ? 'Each participant owes their allocated line items and bill adjustments from the expense snapshot.'
            : 'The recorded expense snapshot contains the final allocation for each participant.';
  const itemizedDetail =
    splitMethod === 'itemized'
      ? {
          lineItems: expense.lineItems.map((item) => ({ ...item, formattedAmount: formatMinor(item.amountMinor, expense.currencyCode) })),
          billAdjustments: expense.billAdjustments.map((adjustment) => ({
            ...adjustment,
            formattedAmount: formatMinor(adjustment.amountMinor, expense.currencyCode)
          }))
        }
      : undefined;

  return {
    expenseId: expense.expenseId,
    groupId: expense.groupId,
    description: expense.description,
    status: expense.status,
    totalAmountMinor: expense.totalAmountMinor,
    currencyCode: expense.currencyCode,
    formattedTotal: formatMinor(expense.totalAmountMinor, expense.currencyCode),
    splitMethod,
    paidBy,
    owedBy,
    itemizedDetail,
    explanation: `${expense.description} totals ${formatMinor(expense.totalAmountMinor, expense.currencyCode)}. ${methodDetail}`,
    snapshotVersion: expense.version
  };
}

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExpensesController {
  constructor(
    private readonly commands: ExpenseCommandService,
    private readonly expenses: ExpenseProjector,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly groups?: GroupsService
  ) {}

  @Post('expenses')
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateExpenseCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<ExpenseCommandService['createExpense']> {
    return this.createAsync(currentUser, idempotencyKey, dto);
  }

  private async createAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateExpenseCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<ExpenseCommandService['createExpense']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.create');
    const result = await this.commands.createExpense({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
    await this.notifyGroupExpense(currentUser.userId, {
      type: 'expense_created',
      title: 'Expense added',
      body: `${dto.description} · ${formatMinor(
        result.expense?.totalAmountMinor ?? dto.payers.reduce((sum, p) => sum + p.amountMinor, 0),
        dto.currencyCode ?? 'INR'
      )}`,
      groupId: dto.groupId,
      expenseId: result.expense?.expenseId ?? dto.expenseId
    });
    return result;
  }

  @Post('expenses/:expenseId/revisions')
  revise(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('expenseId') expenseId: string,
    @Body() dto: Omit<ReviseExpenseCommand, 'actorId' | 'idempotencyKey' | 'expenseId'> & { baseVersion?: number }
  ): ReturnType<ExpenseCommandService['reviseExpense']> {
    return this.reviseAsync(currentUser, idempotencyKey, expenseId, dto);
  }

  private async reviseAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    expenseId: string,
    dto: Omit<ReviseExpenseCommand, 'actorId' | 'idempotencyKey' | 'expenseId'> & { baseVersion?: number }
  ): ReturnType<ExpenseCommandService['reviseExpense']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.edit');
    const expectedVersion = dto.expectedVersion ?? dto.baseVersion ?? (await this.commands.currentVersion(expenseId));
    const result = await this.commands.reviseExpense({
      ...dto,
      expenseId,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
    await this.notifyGroupExpense(currentUser.userId, {
      type: 'expense_revised',
      title: 'Expense updated',
      body: `${dto.description ?? result.expense?.description ?? 'An expense'} was edited.`,
      groupId: dto.groupId,
      expenseId
    });
    return result;
  }

  @Post('expenses/:expenseId/void')
  void(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('expenseId') expenseId: string,
    @Body() dto: Omit<VoidExpenseCommand, 'actorId' | 'idempotencyKey' | 'expenseId'> & { baseVersion?: number }
  ): ReturnType<ExpenseCommandService['voidExpense']> {
    return this.voidAsync(currentUser, idempotencyKey, expenseId, dto);
  }

  private async voidAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    expenseId: string,
    dto: Omit<VoidExpenseCommand, 'actorId' | 'idempotencyKey' | 'expenseId'> & { baseVersion?: number }
  ): ReturnType<ExpenseCommandService['voidExpense']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.void');
    const expectedVersion = dto.expectedVersion ?? dto.baseVersion ?? (await this.commands.currentVersion(expenseId));
    const existing = this.expenses.getExpense(expenseId);
    const result = await this.commands.voidExpense({
      ...dto,
      expenseId,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
    await this.notifyGroupExpense(currentUser.userId, {
      type: 'expense_voided',
      title: 'Expense voided',
      body: `${existing?.description ?? 'An expense'} was voided.`,
      groupId: dto.groupId,
      expenseId
    });
    return result;
  }

  @Get('groups/:groupId/expenses')
  async listGroupExpenses(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<ReturnType<ExpenseProjector['listGroupExpenses']>> {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.expenses.listGroupExpenses(groupId);
  }

  @Get('expenses/:expenseId/history')
  async history(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('expenseId') expenseId: string
  ): Promise<ReturnType<ExpenseProjector['listExpenseHistory']>> {
    const expense = this.expenses.getExpense(expenseId);
    if (expense) {
      await this.authorization.assertCan(currentUser.userId, expense.groupId, 'read');
    }
    return this.expenses.listExpenseHistory(expenseId);
  }

  @Get('expenses/:expenseId/explain')
  async explain(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('expenseId') expenseId: string
  ): Promise<ReturnType<typeof explainExpense>> {
    const expense = this.expenses.getExpense(expenseId);
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }
    await this.authorization.assertCan(currentUser.userId, expense.groupId, 'read');
    return explainExpense(expense);
  }

  private async notifyGroupExpense(
    actorUserId: string,
    input: {
      type: 'expense_created' | 'expense_revised' | 'expense_voided';
      title: string;
      body: string;
      groupId: string;
      expenseId?: string;
    }
  ): Promise<void> {
    if (!this.notifications || !this.groups) {
      return;
    }
    try {
      const memberIds = await this.groups.listActiveMemberUserIds(input.groupId);
      await Promise.all(
        memberIds
          .filter((userId) => userId !== actorUserId)
          .map((userId) =>
            this.notifications!.create({
              userId,
              groupId: input.groupId,
              type: input.type,
              title: input.title,
              body: input.body,
              tone: input.type === 'expense_voided' ? 'action_required' : 'neutral',
              data: {
                groupId: input.groupId,
                expenseId: input.expenseId
              }
            })
          )
      );
    } catch (error) {
      console.error('[expenses] notification failed', error);
    }
  }

  private requireIdempotencyKey(headerValue: string | undefined, body: unknown): string {
    const bodyValue = (body as { idempotencyKey?: string }).idempotencyKey;
    const key = headerValue ?? bodyValue;
    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }
    return key;
  }
}

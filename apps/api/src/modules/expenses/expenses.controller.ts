import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { ExpenseProjector } from '../ledger';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { ExpenseCommandService } from './expense-command.service';
import type { CreateExpenseCommand, ReviseExpenseCommand, VoidExpenseCommand } from './expense.types';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExpensesController {
  constructor(
    private readonly commands: ExpenseCommandService,
    private readonly expenses: ExpenseProjector,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
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
    return this.commands.createExpense({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
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
    return this.commands.reviseExpense({
      ...dto,
      expenseId,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
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
    return this.commands.voidExpense({
      ...dto,
      expenseId,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
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

  private requireIdempotencyKey(headerValue: string | undefined, body: unknown): string {
    const bodyValue = (body as { idempotencyKey?: string }).idempotencyKey;
    const key = headerValue ?? bodyValue;
    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }
    return key;
  }
}

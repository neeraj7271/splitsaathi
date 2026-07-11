import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { RecurringExpenseService } from './recurring-expense.service';
import { RecurringProjector } from './recurring.projector';
import { ReminderScheduleService } from './reminder-schedule.service';
import type { CreateRecurringScheduleCommand, GenerateRecurringExpensesCommand } from './recurring.types';

@ApiTags('recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class RecurringController {
  constructor(
    private readonly commands: RecurringExpenseService,
    private readonly projection: RecurringProjector,
    private readonly reminders: ReminderScheduleService,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Post('recurring-schedules')
  createSchedule(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateRecurringScheduleCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<RecurringExpenseService['createSchedule']> {
    return this.createScheduleAsync(currentUser, idempotencyKey, dto);
  }

  private async createScheduleAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateRecurringScheduleCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<RecurringExpenseService['createSchedule']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.create');
    return this.commands.createSchedule({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Post('recurring-schedules/generate-due')
  generateDue(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<GenerateRecurringExpensesCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<RecurringExpenseService['generateDue']> {
    return this.generateDueAsync(currentUser, idempotencyKey, dto);
  }

  private async generateDueAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<GenerateRecurringExpensesCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<RecurringExpenseService['generateDue']> {
    for (const schedule of this.projection.listActiveSchedules().filter((schedule) => schedule.nextRunDate <= dto.asOfDate)) {
      await this.authorization.assertCan(currentUser.userId, schedule.groupId, 'expense.create');
    }
    return this.commands.generateDue({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Get('groups/:groupId/recurring-schedules')
  async listGroupSchedules(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<ReturnType<RecurringProjector['listGroupSchedules']>> {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.projection.listGroupSchedules(groupId);
  }

  @Post('reminder-schedules')
  createReminderSchedule(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: { groupId: string; type: 'settlement_day' | 'recurring_expense' | 'stale_proof'; schedule: Record<string, unknown> }
  ) {
    return this.createReminderScheduleAsync(currentUser, dto);
  }

  private async createReminderScheduleAsync(
    currentUser: AuthenticatedUser,
    dto: { groupId: string; type: 'settlement_day' | 'recurring_expense' | 'stale_proof'; schedule: Record<string, unknown> }
  ) {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'read');
    return this.reminders.create({
      ...dto,
      createdBy: currentUser.userId
    });
  }

  @Get('groups/:groupId/reminder-schedules')
  async listReminderSchedules(@CurrentUser() currentUser: AuthenticatedUser, @Param('groupId') groupId: string) {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.reminders.listForGroup(groupId);
  }

  @Post('reminder-schedules/due')
  async findDueReminders(@CurrentUser() _currentUser: AuthenticatedUser, @Body() dto: { asOf?: string }) {
    return this.reminders.findDue(dto.asOf ? new Date(dto.asOf) : new Date());
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

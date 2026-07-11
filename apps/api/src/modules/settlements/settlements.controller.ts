import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { SettlementProjector } from './settlement.projector';
import { SettlementCommandService } from './settlement-command.service';
import { SettlementSuggestionService } from './settlement-suggestion.service';
import type {
  CreateSettlementIntentCommand,
  MarkUpiOpenedCommand,
  SettlementTransitionCommand,
  SubmitPaymentProofCommand
} from './settlement.types';

@ApiTags('settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SettlementsController {
  constructor(
    private readonly commands: SettlementCommandService,
    private readonly settlements: SettlementProjector,
    private readonly suggestions: SettlementSuggestionService,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Get('groups/:groupId/settlement-suggestions')
  async suggest(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<ReturnType<SettlementSuggestionService['suggestForGroup']>> {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.suggestions.suggestForGroup(groupId);
  }

  @Post('settlement-intents')
  createIntent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateSettlementIntentCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SettlementCommandService['createIntent']> {
    return this.createIntentAsync(currentUser, idempotencyKey, dto);
  }

  private async createIntentAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateSettlementIntentCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SettlementCommandService['createIntent']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'settlement.confirm');
    try {
      return await this.commands.createIntent({
        ...dto,
        actorId: currentUser.userId,
        idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
      });
    } catch (error) {
      if (error instanceof Error && /UPI|VPA|minor-unit/.test(error.message)) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('settlement-intents/:id/upi/opened')
  upiOpened(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<MarkUpiOpenedCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['markUpiOpened']> {
    return this.upiOpenedAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async upiOpenedAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<MarkUpiOpenedCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['markUpiOpened']> {
    await this.assertCanActOnIntent(currentUser.userId, settlementIntentId, 'settlement.confirm');
    const expectedVersion = dto.expectedVersion ?? (await this.commands.currentVersion(settlementIntentId));
    return this.commands.markUpiOpened({
      ...dto,
      settlementIntentId,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Post('settlement-intents/:id/proofs')
  submitProof(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SubmitPaymentProofCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['submitProof']> {
    return this.submitProofAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async submitProofAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SubmitPaymentProofCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['submitProof']> {
    await this.assertCanActOnIntent(currentUser.userId, settlementIntentId, 'settlement.confirm');
    const normalizedDto = dto as typeof dto & {
      claimedAmountMinor?: number;
      upiReference?: string;
      utrText?: string;
    };
    const expectedVersion = dto.expectedVersion ?? (await this.commands.currentVersion(settlementIntentId));
    return this.commands.submitProof({
      ...normalizedDto,
      settlementIntentId,
      amountMinor: dto.amountMinor ?? normalizedDto.claimedAmountMinor,
      utr: dto.utr ?? normalizedDto.upiReference ?? normalizedDto.utrText,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Post('settlement-intents/:id/confirm')
  confirm(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['confirm']> {
    return this.confirmAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async confirmAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['confirm']> {
    return this.commands.confirm(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/reject')
  reject(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['reject']> {
    return this.rejectAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async rejectAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['reject']> {
    return this.commands.reject(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/dispute')
  dispute(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['dispute']> {
    return this.disputeAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async disputeAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['dispute']> {
    return this.commands.dispute(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/reverse')
  reverse(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['reverse']> {
    return this.reverseAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async reverseAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['reverse']> {
    return this.commands.reverse(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/refund')
  refund(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['refund']> {
    return this.refundAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async refundAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['refund']> {
    return this.commands.refund(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/expire')
  expire(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['expire']> {
    return this.expireAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async expireAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['expire']> {
    return this.commands.expire(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Post('settlement-intents/:id/cancel')
  cancel(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') settlementIntentId: string,
    @Body() dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['cancel']> {
    return this.cancelAsync(currentUser, idempotencyKey, settlementIntentId, dto);
  }

  private async cancelAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): ReturnType<SettlementCommandService['cancel']> {
    return this.commands.cancel(await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto));
  }

  @Get('settlement-intents/:id')
  async getIntent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') settlementIntentId: string
  ): Promise<ReturnType<SettlementProjector['getIntent']>> {
    await this.assertCanActOnIntent(currentUser.userId, settlementIntentId, 'read');
    return this.settlements.getIntent(settlementIntentId);
  }

  @Get('groups/:groupId/settlement-intents')
  async listGroupIntents(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<ReturnType<SettlementProjector['listGroupIntents']>> {
    await this.authorization.assertCan(currentUser.userId, groupId, 'read');
    return this.settlements.listGroupIntents(groupId);
  }

  private async transitionCommand(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    settlementIntentId: string,
    dto: Omit<SettlementTransitionCommand, 'actorId' | 'idempotencyKey' | 'settlementIntentId'>
  ): Promise<SettlementTransitionCommand> {
    await this.assertCanActOnIntent(currentUser.userId, settlementIntentId, 'settlement.confirm');
    return {
      ...dto,
      settlementIntentId,
      expectedVersion: dto.expectedVersion ?? (await this.commands.currentVersion(settlementIntentId)),
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    };
  }

  private requireIdempotencyKey(headerValue: string | undefined, body: unknown): string {
    const bodyValue = (body as { idempotencyKey?: string }).idempotencyKey;
    const key = headerValue ?? bodyValue;
    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }
    return key;
  }

  private async assertCanActOnIntent(
    userId: string,
    settlementIntentId: string,
    action: 'read' | 'settlement.confirm'
  ): Promise<void> {
    const intent = this.settlements.getIntent(settlementIntentId);
    if (!intent) {
      return;
    }
    await this.authorization.assertCan(userId, intent.groupId, action);
  }
}

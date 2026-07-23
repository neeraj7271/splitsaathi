import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
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
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { NotificationsService } from '../notifications/notifications.service';
import { SettlementProjector } from './settlement.projector';
import { SettlementCommandService } from './settlement-command.service';
import { SettlementSuggestionService } from './settlement-suggestion.service';
import type {
  CreateSettlementIntentCommand,
  MarkUpiOpenedCommand,
  SettlementIntentRow,
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
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly groups?: GroupsService
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
    await this.assertActorIsPayerForCreate(currentUser.userId, dto);

    let payeeVpa = dto.payeeVpa?.trim() || undefined;
    if ((dto.paymentMethod ?? 'upi') !== 'cash' && !payeeVpa && this.groups) {
      payeeVpa = (await this.groups.resolveUpiVpaForParticipant(dto.groupId, dto.payeeParticipantId)) ?? undefined;
    }

    try {
      return await this.commands.createIntent({
        ...dto,
        payeeVpa,
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
    await this.assertActorIsPayer(currentUser.userId, settlementIntentId);
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
    await this.assertActorIsPayer(currentUser.userId, settlementIntentId);
    const normalizedDto = dto as typeof dto & {
      claimedAmountMinor?: number;
      upiReference?: string;
      utrText?: string;
    };
    const expectedVersion = dto.expectedVersion ?? (await this.commands.currentVersion(settlementIntentId));
    const result = await this.commands.submitProof({
      ...normalizedDto,
      settlementIntentId,
      amountMinor: dto.amountMinor ?? normalizedDto.claimedAmountMinor,
      utr: dto.utr ?? normalizedDto.upiReference ?? normalizedDto.utrText,
      expectedVersion,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
    await this.notifySettlementConfirmationRequested(result.intent);
    return result;
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
    await this.assertActorIsPayee(currentUser.userId, settlementIntentId);
    const result = await this.commands.confirm(
      await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto)
    );
    await this.notifySettlementConfirmed(result.intent);
    return result;
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
    await this.assertActorIsPayee(currentUser.userId, settlementIntentId);
    const result = await this.commands.reject(
      await this.transitionCommand(currentUser, idempotencyKey, settlementIntentId, dto)
    );
    await this.notifySettlementRejected(result.intent, dto.reason);
    return result;
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
  ): Promise<SettlementIntentRow | undefined> {
    const intent = this.settlements.getIntent(settlementIntentId);
    if (!intent) {
      return undefined;
    }
    await this.authorization.assertCan(userId, intent.groupId, action);
    return intent;
  }

  private async assertActorIsPayer(userId: string, settlementIntentId: string): Promise<SettlementIntentRow> {
    const intent = await this.assertCanActOnIntent(userId, settlementIntentId, 'settlement.confirm');
    if (!intent) {
      throw new BadRequestException('Settlement intent not found.');
    }
    if (!this.groups) {
      return intent;
    }
    const payerUserId = await this.groups.resolveUserIdForParticipant(intent.groupId, intent.payerParticipantId);
    if (payerUserId && payerUserId !== userId) {
      throw new ForbiddenException('Only the payer can open UPI or submit payment proof.');
    }
    return intent;
  }

  private async assertActorIsPayerForCreate(
    userId: string,
    dto: Pick<CreateSettlementIntentCommand, 'groupId' | 'payerParticipantId'>
  ): Promise<void> {
    if (!this.groups) {
      return;
    }
    const payerUserId = await this.groups.resolveUserIdForParticipant(dto.groupId, dto.payerParticipantId);
    if (payerUserId && payerUserId !== userId) {
      throw new ForbiddenException('Only the person who owes can start this settlement payment.');
    }
  }

  private async assertActorIsPayee(userId: string, settlementIntentId: string): Promise<SettlementIntentRow> {
    const intent = await this.assertCanActOnIntent(userId, settlementIntentId, 'settlement.confirm');
    if (!intent) {
      throw new BadRequestException('Settlement intent not found.');
    }
    if (!this.groups) {
      return intent;
    }
    const payeeUserId = await this.groups.resolveUserIdForParticipant(intent.groupId, intent.payeeParticipantId);
    if (payeeUserId && payeeUserId !== userId) {
      throw new ForbiddenException('Only the payee can confirm or reject this payment.');
    }
    return intent;
  }

  private async notifySettlementConfirmationRequested(intent: SettlementIntentRow): Promise<void> {
    if (!this.notifications || !this.groups) {
      return;
    }
    try {
      const [payeeUserId, payerUserId, groupName] = await Promise.all([
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payeeParticipantId),
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payerParticipantId),
        this.groups.getGroupName(intent.groupId)
      ]);
      const amountLabel = formatInrMinor(intent.amountMinor, intent.currencyCode);
      const data = {
        settlementIntentId: intent.settlementIntentId,
        amountMinor: intent.amountMinor,
        currencyCode: intent.currencyCode,
        payerParticipantId: intent.payerParticipantId,
        payeeParticipantId: intent.payeeParticipantId
      };
      if (payeeUserId) {
        await this.notifications.create({
          userId: payeeUserId,
          groupId: intent.groupId,
          type: 'settlement_confirmation_requested',
          title: 'Confirm payment',
          body: `${groupName} · Please confirm you received ${amountLabel}.`,
          tone: 'action_required',
          data
        });
      }
      if (payerUserId) {
        await this.notifications.create({
          userId: payerUserId,
          groupId: intent.groupId,
          type: 'settlement_awaiting_confirmation',
          title: 'Waiting for confirmation',
          body: `${groupName} · Your ${amountLabel} payment is waiting for the receiver to confirm.`,
          data
        });
      }
    } catch (error) {
      // Never block UPI handoff / settlement on notification delivery failures.
      console.error('[settlements] confirm-request notification failed', error);
    }
  }

  private async notifySettlementConfirmed(intent: SettlementIntentRow): Promise<void> {
    if (!this.notifications || !this.groups) {
      return;
    }
    try {
      const [payerUserId, payeeUserId, groupName] = await Promise.all([
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payerParticipantId),
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payeeParticipantId),
        this.groups.getGroupName(intent.groupId)
      ]);
      const amountLabel = formatInrMinor(intent.amountMinor, intent.currencyCode);
      const data = {
        settlementIntentId: intent.settlementIntentId,
        amountMinor: intent.amountMinor,
        currencyCode: intent.currencyCode,
        payerParticipantId: intent.payerParticipantId,
        payeeParticipantId: intent.payeeParticipantId
      };
      if (payerUserId) {
        await this.notifications.create({
          userId: payerUserId,
          groupId: intent.groupId,
          type: 'settlement_confirmed',
          title: 'Payment confirmed',
          body: `${groupName} · Your payment of ${amountLabel} was confirmed.`,
          data
        });
      }
      if (payeeUserId) {
        await this.notifications.create({
          userId: payeeUserId,
          groupId: intent.groupId,
          type: 'settlement_received_confirmed',
          title: 'Settlement complete',
          body: `${groupName} · You confirmed receiving ${amountLabel}. Balances are updated.`,
          data
        });
      }
    } catch (error) {
      console.error('[settlements] confirmed notification failed', error);
    }
  }

  private async notifySettlementRejected(intent: SettlementIntentRow, reason?: string): Promise<void> {
    if (!this.notifications || !this.groups) {
      return;
    }
    try {
      const [payerUserId, payeeUserId, groupName] = await Promise.all([
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payerParticipantId),
        this.groups.resolveUserIdForParticipant(intent.groupId, intent.payeeParticipantId),
        this.groups.getGroupName(intent.groupId)
      ]);
      const amountLabel = formatInrMinor(intent.amountMinor, intent.currencyCode);
      const reasonText = reason?.trim();
      const reasonSuffix = reasonText ? ` Reason: ${reasonText}` : '';
      const data = {
        settlementIntentId: intent.settlementIntentId,
        amountMinor: intent.amountMinor,
        currencyCode: intent.currencyCode,
        payerParticipantId: intent.payerParticipantId,
        payeeParticipantId: intent.payeeParticipantId,
        ...(reasonText ? { reason: reasonText } : {})
      };
      if (payerUserId) {
        await this.notifications.create({
          userId: payerUserId,
          groupId: intent.groupId,
          type: 'settlement_rejected',
          title: 'Payment not confirmed',
          body: `${groupName} · Your ${amountLabel} payment was rejected by the receiver.${reasonSuffix}`,
          tone: 'action_required',
          data
        });
      }
      if (payeeUserId) {
        await this.notifications.create({
          userId: payeeUserId,
          groupId: intent.groupId,
          type: 'settlement_rejected',
          title: 'Payment rejected',
          body: `${groupName} · You rejected a ${amountLabel} payment claim.${reasonSuffix}`,
          data
        });
      }
    } catch (error) {
      console.error('[settlements] rejected notification failed', error);
    }
  }
}

function formatInrMinor(amountMinor: number, currencyCode: string): string {
  const major = (amountMinor / 100).toFixed(2);
  if (currencyCode === 'INR') {
    return `₹${major}`;
  }
  return `${major} ${currencyCode}`;
}

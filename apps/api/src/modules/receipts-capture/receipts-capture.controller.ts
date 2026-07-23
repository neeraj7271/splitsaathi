import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Optional,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import type { CreateExpenseCommand } from '../expenses';
import { GroupEntity } from '../groups/entities/group.entity';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { SettlementProjector } from '../settlements/settlement.projector';
import { ReceiptsCaptureService } from './receipts-capture.service';

@ApiTags('receipts-capture')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReceiptsCaptureController {
  constructor(
    private readonly receipts: ReceiptsCaptureService,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort,
    private readonly settlements: SettlementProjector,
    @Optional()
    @InjectRepository(GroupEntity)
    private readonly groupRepository?: Repository<GroupEntity>
  ) {}

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file'))
  createAttachment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body() body: { purpose?: string; name?: string; type?: string; sizeBytes?: number }
  ) {
    return this.receipts.createAttachment({
      purpose: body.purpose ?? 'receipt',
      uploadedBy: currentUser.userId,
      originalName: file?.originalname ?? body.name,
      mimeType: file?.mimetype ?? body.type,
      sizeBytes: file?.size ?? body.sizeBytes,
      buffer: file?.buffer
    });
  }

  @Public()
  @Get('public/avatars/:id')
  async streamPublicAvatar(@Param('id') attachmentId: string, @Res() response: Response) {
    const content = await this.receipts.getPublicAvatarContent(attachmentId);
    response.setHeader('Content-Type', content.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(content.buffer);
  }

  @Get('attachments/:id/content')
  async streamAttachmentContent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') attachmentId: string,
    @Res() response: Response
  ) {
    const content = await this.receipts.getAttachmentContent(attachmentId, currentUser.userId, {
      resolveSharedGroupAccess: async (purpose) => {
        if (purpose === 'payment_proof') {
          const intent = this.settlements.findIntentByProofAttachmentId(attachmentId);
          if (!intent) {
            return false;
          }
          await this.authorization.assertCan(currentUser.userId, intent.groupId, 'read');
          return true;
        }
        if (purpose === 'group_image' && this.groupRepository) {
          const group = await this.groupRepository.findOne({ where: { imageAttachmentId: attachmentId } });
          if (!group) {
            return false;
          }
          await this.authorization.assertCan(currentUser.userId, group.id, 'read');
          return true;
        }
        return false;
      }
    });
    response.setHeader('Content-Type', content.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.send(content.buffer);
  }

  @Post('receipt-drafts')
  createReceiptDraft(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: { groupId: string; attachmentId?: string; source?: string }
  ) {
    return this.createReceiptDraftAsync(currentUser, body);
  }

  @Post('capture-jobs')
  createCaptureJob(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: { source?: string; rawText?: string; attachmentId?: string }
  ) {
    return this.receipts.createCaptureJob({
      userId: currentUser.userId,
      source: body.source ?? 'paste',
      rawText: body.rawText,
      attachmentId: body.attachmentId
    });
  }

  @Post('receipt-drafts/:id/ocr')
  analyzeReceiptDraft(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') receiptDraftId: string) {
    return this.analyzeReceiptDraftAsync(currentUser, receiptDraftId);
  }

  private async analyzeReceiptDraftAsync(currentUser: AuthenticatedUser, receiptDraftId: string) {
    const draft = await this.receipts.getReceiptDraft(receiptDraftId);
    if (!draft) {
      throw new BadRequestException('Receipt draft not found.');
    }
    await this.authorization.assertCan(currentUser.userId, draft.groupId, 'read');
    return this.receipts.analyzeReceiptDraft(receiptDraftId);
  }

  private async createReceiptDraftAsync(
    currentUser: AuthenticatedUser,
    body: { groupId: string; attachmentId?: string; source?: string }
  ) {
    if (!body.groupId) {
      throw new BadRequestException('groupId is required.');
    }
    await this.authorization.assertCan(currentUser.userId, body.groupId, 'read');
    return this.receipts.createReceiptDraft({
      ...body,
      createdBy: currentUser.userId
    });
  }

  @Post('receipt-drafts/:id/post-expense')
  postReceiptDraftExpense(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') receiptDraftId: string,
    @Body() body: Omit<CreateExpenseCommand, 'actorId' | 'idempotencyKey'>
  ) {
    return this.postReceiptDraftExpenseAsync(currentUser, idempotencyKey, receiptDraftId, body);
  }

  private async postReceiptDraftExpenseAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    receiptDraftId: string,
    body: Omit<CreateExpenseCommand, 'actorId' | 'idempotencyKey'>
  ) {
    const bodyIdempotencyKey = (body as unknown as { idempotencyKey?: string }).idempotencyKey;
    if (!idempotencyKey && !bodyIdempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }
    await this.authorization.assertCan(currentUser.userId, body.groupId, 'expense.create');
    return this.receipts.postReceiptDraftExpense(
      receiptDraftId,
      currentUser.userId,
      idempotencyKey ?? bodyIdempotencyKey!,
      body
    );
  }
}

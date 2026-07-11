import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { ConsentsService } from './consents.service';

@ApiTags('consents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Post()
  recordConsent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: { purpose: string; status: 'granted' | 'revoked'; source?: string; metadata?: Record<string, unknown> }
  ) {
    return this.consents.record({
      ...body,
      userId: currentUser.userId
    });
  }

  @Get()
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.consents.listForUser(currentUser.userId);
  }
}

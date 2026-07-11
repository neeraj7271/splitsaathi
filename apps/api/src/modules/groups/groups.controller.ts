import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { AddParticipantDto } from './dto/add-participant.dto';
import { ClaimInviteDto } from './dto/claim-invite.dto';
import { ChangeMembershipRoleDto } from './dto/change-membership-role.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import {
  GroupResponseDto,
  GroupSummaryResponseDto,
  InviteResponseDto,
  MembershipResponseDto,
  ObligationTransferResponseDto,
  ParticipantResponseDto
} from './dto/group-response.dto';
import { LockExitDto } from './dto/lock-exit.dto';
import { ObligationTransferDto } from './dto/obligation-transfer.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiCreatedResponse({ type: GroupResponseDto })
  createGroup(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateGroupDto
  ): Promise<GroupResponseDto> {
    return this.groupsService.createGroup(currentUser.userId, dto);
  }

  @Get()
  @ApiOkResponse({ type: GroupSummaryResponseDto, isArray: true })
  listGroups(@CurrentUser() currentUser: AuthenticatedUser): Promise<GroupSummaryResponseDto[]> {
    return this.groupsService.listGroups(currentUser.userId);
  }

  @Get(':groupId')
  @ApiOkResponse({ type: GroupResponseDto })
  getGroup(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<GroupResponseDto> {
    return this.groupsService.getGroupForUser(currentUser.userId, groupId);
  }

  @Post(':groupId/invites')
  @ApiCreatedResponse({ type: InviteResponseDto })
  createInvite(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateInviteDto
  ): Promise<InviteResponseDto> {
    return this.groupsService.createInvite(currentUser.userId, groupId, dto);
  }

  @Public()
  @Get('invites/:token')
  @ApiOkResponse({ type: InviteResponseDto })
  previewInvite(@Param('token') token: string): Promise<InviteResponseDto> {
    return this.groupsService.previewInvite(token);
  }

  @Post('invites/:token/claim')
  @ApiOkResponse({ type: GroupResponseDto })
  claimInvite(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('token') token: string,
    @Body() dto: ClaimInviteDto
  ): Promise<GroupResponseDto> {
    return this.groupsService.claimInvite(currentUser.userId, token, dto);
  }

  @Post(':groupId/participants')
  @ApiCreatedResponse({ type: ParticipantResponseDto })
  addParticipant(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: AddParticipantDto
  ): Promise<ParticipantResponseDto> {
    return this.groupsService.addParticipant(currentUser.userId, groupId, dto);
  }

  @Patch(':groupId/memberships/:membershipId/role')
  @ApiOkResponse({ type: MembershipResponseDto })
  changeRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: ChangeMembershipRoleDto
  ): Promise<MembershipResponseDto> {
    return this.groupsService.changeMembershipRole(currentUser.userId, groupId, membershipId, dto);
  }

  @Post(':groupId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: GroupResponseDto })
  archiveGroup(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<GroupResponseDto> {
    return this.groupsService.archiveGroup(currentUser.userId, groupId);
  }

  @Post(':groupId/memberships/:membershipId/lock-exit')
  @ApiOkResponse({ type: MembershipResponseDto })
  lockExit(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: LockExitDto
  ): Promise<MembershipResponseDto> {
    return this.groupsService.lockMembershipForExit(currentUser.userId, groupId, membershipId, dto);
  }

  @Post(':groupId/obligation-transfers')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: ObligationTransferResponseDto })
  transferObligation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: ObligationTransferDto
  ): Promise<ObligationTransferResponseDto> {
    return this.groupsService.requestObligationTransfer(currentUser.userId, groupId, dto);
  }
}

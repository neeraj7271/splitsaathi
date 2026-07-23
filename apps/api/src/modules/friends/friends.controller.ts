import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import {
  FriendDetailDto,
  FriendSummaryDto,
  RemindFriendResponseDto
} from './dto/friend-response.dto';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOkResponse({ type: [FriendSummaryDto] })
  list(@CurrentUser() currentUser: AuthenticatedUser): Promise<FriendSummaryDto[]> {
    return this.friendsService.listFriends(currentUser.userId);
  }

  @Get(':otherUserId')
  @ApiOkResponse({ type: FriendDetailDto })
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('otherUserId', ParseUUIDPipe) otherUserId: string
  ): Promise<FriendDetailDto> {
    return this.friendsService.getFriendDetail(currentUser.userId, otherUserId);
  }

  @Post(':otherUserId/remind')
  @ApiOkResponse({ type: RemindFriendResponseDto })
  remind(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('otherUserId', ParseUUIDPipe) otherUserId: string
  ): Promise<RemindFriendResponseDto> {
    return this.friendsService.remindFriend(currentUser.userId, otherUserId);
  }
}

import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { UpdateUserDto, UpdateUserPreferencesDto } from './dto/update-user.dto';
import { UserPreferencesResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdOrThrow(currentUser.userId);
    const phoneE164 = await this.usersService.getPhoneE164ForUser(currentUser.userId);
    const phoneMasked = phoneE164
      ? (await this.usersService.getPhoneMaskedForUser(currentUser.userId))
      : undefined;
    const email = await this.usersService.getEmailForUser(currentUser.userId);
    return UserResponseDto.fromEntity(user, { phoneMasked, phoneE164, email });
  }

  @Patch('me')
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    if (dto.displayName === undefined && dto.avatarAttachmentId === undefined && dto.upiVpa === undefined) {
      throw new BadRequestException('At least one field must be provided.');
    }
    const user = await this.usersService.findByIdOrThrow(currentUser.userId);
    const updated = await this.usersService.updateUser(user, {
      displayName: dto.displayName?.trim(),
      avatarAttachmentId: dto.avatarAttachmentId,
      upiVpa: dto.upiVpa
    });
    const phoneE164 = await this.usersService.getPhoneE164ForUser(currentUser.userId);
    const phoneMasked = phoneE164
      ? (await this.usersService.getPhoneMaskedForUser(currentUser.userId))
      : undefined;
    const email = await this.usersService.getEmailForUser(currentUser.userId);
    return UserResponseDto.fromEntity(updated, { phoneMasked, phoneE164, email });
  }

  @Get('me/preferences')
  @ApiOkResponse({ type: UserPreferencesResponseDto })
  async getPreferences(@CurrentUser() currentUser: AuthenticatedUser): Promise<UserPreferencesResponseDto> {
    const preferences = await this.usersService.getPreferencesForUser(currentUser.userId);
    return this.usersService.toPreferencesDto(preferences);
  }

  @Patch('me/preferences')
  @ApiOkResponse({ type: UserPreferencesResponseDto })
  async updatePreferences(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateUserPreferencesDto
  ): Promise<UserPreferencesResponseDto> {
    const preferences = await this.usersService.updatePreferences(currentUser.userId, dto);
    return this.usersService.toPreferencesDto(preferences);
  }

  @Post('me/delete-account')
  @ApiOkResponse({ description: 'Schedule account deletion and revoke active sessions' })
  async deleteAccount(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.deleteAccount(currentUser.userId);
  }
}

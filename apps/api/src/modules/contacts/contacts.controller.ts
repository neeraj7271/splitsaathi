import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { ContactsService } from './contacts.service';
import { ContactResponseDto, ImportContactsResponseDto } from './dto/contact-response.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOkResponse({ type: ContactResponseDto, isArray: true })
  listContacts(@CurrentUser() currentUser: AuthenticatedUser): Promise<ContactResponseDto[]> {
    return this.contacts.listContacts(currentUser.userId);
  }

  @Post('import')
  @ApiCreatedResponse({ type: ImportContactsResponseDto })
  importContacts(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ImportContactsDto
  ): Promise<ImportContactsResponseDto> {
    return this.contacts.importContacts(currentUser.userId, dto);
  }
}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentEntity } from '@splitsaathi/db';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiConfigModule } from '../../config/api-config.module';
import { BalanceProjectorModule } from '../ledger/balance-projector.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { GroupInviteEntity } from './entities/group-invite.entity';
import { GroupMembershipEntity } from './entities/group-membership.entity';
import { GroupRolePermissionEntity } from './entities/group-role-permission.entity';
import { GroupEntity } from './entities/group.entity';
import { ParticipantEntity } from './entities/participant.entity';
import { GroupsController } from './groups.controller';
import { JoinLinkController } from './join-link.controller';
import { GroupsService } from './groups.service';
import { OBLIGATION_TRANSFER_PORT } from './ports/obligation-transfer.port';
import { NoopObligationTransferProvider } from './providers/noop-obligation-transfer.provider';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    BalanceProjectorModule,
    UsersModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      GroupEntity,
      ParticipantEntity,
      GroupMembershipEntity,
      GroupRolePermissionEntity,
      GroupInviteEntity,
      AttachmentEntity
    ])
  ],
  controllers: [GroupsController, JoinLinkController],
  providers: [
    GroupsService,
    JwtAuthGuard,
    NoopObligationTransferProvider,
    {
      provide: OBLIGATION_TRANSFER_PORT,
      useExisting: NoopObligationTransferProvider
    }
  ],
  exports: [GroupsService, TypeOrmModule]
})
export class GroupsModule {}

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppEnv } from '@splitsaathi/config';
import { AuthIdentityEntity } from '../modules/auth/entities/auth-identity.entity';
import { OtpChallengeEntity } from '../modules/auth/entities/otp-challenge.entity';
import { RefreshSessionEntity } from '../modules/auth/entities/refresh-session.entity';
import { GroupInviteEntity } from '../modules/groups/entities/group-invite.entity';
import { GroupMembershipEntity } from '../modules/groups/entities/group-membership.entity';
import { GroupRolePermissionEntity } from '../modules/groups/entities/group-role-permission.entity';
import { GroupEntity } from '../modules/groups/entities/group.entity';
import { ParticipantEntity } from '../modules/groups/entities/participant.entity';
import { NotificationDeliveryEntity } from '../modules/notifications/entities/notification-delivery.entity';
import { NotificationEntity } from '../modules/notifications/entities/notification.entity';
import { UserEntity } from '../modules/users/entities/user.entity';

export const apiEntities = [
  UserEntity,
  AuthIdentityEntity,
  OtpChallengeEntity,
  RefreshSessionEntity,
  GroupEntity,
  ParticipantEntity,
  GroupMembershipEntity,
  GroupRolePermissionEntity,
  GroupInviteEntity,
  NotificationEntity,
  NotificationDeliveryEntity
];

export function createTypeOrmOptions(env: AppEnv): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: env.NODE_ENV === 'test' && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
    entities: apiEntities,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  };
}

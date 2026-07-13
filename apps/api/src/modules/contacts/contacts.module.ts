import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactAliasEntity } from '@splitsaathi/db';
import { ApiConfigModule } from '../../config/api-config.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { ConsentsModule } from '../consents/consents.module';
import { UserEntity } from '../users/entities/user.entity';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    ConsentsModule,
    TypeOrmModule.forFeature([ContactAliasEntity, AuthIdentityEntity, UserEntity])
  ],
  controllers: [ContactsController],
  providers: [ContactsService, JwtAuthGuard],
  exports: [ContactsService]
})
export class ContactsModule {}

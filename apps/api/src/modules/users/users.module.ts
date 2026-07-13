import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AttachmentEntity } from '@splitsaathi/db';
import { ApiConfigModule } from '../../config/api-config.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { UserPreferencesEntity } from './entities/user-preferences.entity';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    ApiConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserEntity, UserPreferencesEntity, AuthIdentityEntity, AttachmentEntity])
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard],
  exports: [UsersService, TypeOrmModule]
})
export class UsersModule {}

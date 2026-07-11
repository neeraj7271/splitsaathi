import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecordEntity } from '@splitsaathi/db';
import { ApiConfigModule } from '../../config/api-config.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';

@Module({
  imports: [ApiConfigModule, JwtModule.register({}), TypeOrmModule.forFeature([ConsentRecordEntity])],
  controllers: [ConsentsController],
  providers: [ConsentsService, JwtAuthGuard],
  exports: [ConsentsService]
})
export class ConsentsModule {}

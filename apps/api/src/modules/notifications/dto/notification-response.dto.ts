import { ApiProperty } from '@nestjs/swagger';
import { NotificationEntity } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  groupId!: string | null;

  @ApiProperty({ example: 'group_invite_created' })
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ example: 'neutral' })
  tone!: string;

  @ApiProperty({ nullable: true })
  readAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  static fromEntity(entity: NotificationEntity): NotificationResponseDto {
    return {
      id: entity.id,
      groupId: entity.groupId,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      tone: entity.tone,
      readAt: entity.readAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString()
    };
  }
}

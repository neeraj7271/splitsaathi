import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Priya Shah' })
  displayName!: string;

  @ApiProperty({ example: 'INR' })
  defaultCurrencyCode!: string;

  @ApiProperty({ example: 'active' })
  state!: string;

  static fromEntity(entity: UserEntity): UserResponseDto {
    return {
      id: entity.id,
      displayName: entity.displayName,
      defaultCurrencyCode: entity.defaultCurrencyCode,
      state: entity.state
    };
  }
}

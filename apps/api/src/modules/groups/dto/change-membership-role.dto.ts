import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ChangeMembershipRoleDto {
  @ApiProperty({ enum: ['admin', 'member', 'viewer'] })
  @IsIn(['admin', 'member', 'viewer'])
  role!: 'admin' | 'member' | 'viewer';
}

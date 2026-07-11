import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MembershipRoles } from '@splitsaathi/contracts';

const assignableRoles = MembershipRoles.filter((role) => role !== 'owner');

export class AddParticipantDto {
  @ApiProperty({ example: 'Ananya' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ required: false, example: '+919876543212' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phoneE164?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  linkedUserId?: string;

  @ApiProperty({ enum: assignableRoles, default: 'member' })
  @IsOptional()
  @IsIn(assignableRoles)
  role: 'admin' | 'member' | 'viewer' = 'member';
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GroupMode, GroupModes, MembershipRoles } from '@splitsaathi/contracts';

const assignableRoles = MembershipRoles.filter((role) => role !== 'owner');
const groupTypes = ['trip', 'couple', 'home', 'event', 'business', 'other'] as const;

export class CreateGroupParticipantDto {
  @ApiProperty({ example: 'Rahul' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ required: false, example: '+919876543211' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phoneE164?: string;

  @ApiProperty({ enum: assignableRoles, default: 'member' })
  @IsOptional()
  @IsIn(assignableRoles)
  role: 'admin' | 'member' | 'viewer' = 'member';
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Indiranagar Flat' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: GroupModes, default: 'flat' })
  @IsOptional()
  @IsIn(GroupModes)
  mode: GroupMode = 'flat';

  @ApiProperty({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrencyCode = 'INR';

  @ApiProperty({ example: 'Trip', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiProperty({ enum: groupTypes, default: 'other' })
  @IsOptional()
  @IsIn(groupTypes)
  groupType: (typeof groupTypes)[number] = 'other';

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  imageAttachmentId?: string;

  @ApiProperty({ type: CreateGroupParticipantDto, isArray: true, default: [] })
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateGroupParticipantDto)
  participants: CreateGroupParticipantDto[] = [];
}

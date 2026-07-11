import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GroupMode, GroupModes, MembershipRoles } from '@splitsaathi/contracts';

const assignableRoles = MembershipRoles.filter((role) => role !== 'owner');

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

  @ApiProperty({ type: CreateGroupParticipantDto, isArray: true, default: [] })
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateGroupParticipantDto)
  participants: CreateGroupParticipantDto[] = [];
}

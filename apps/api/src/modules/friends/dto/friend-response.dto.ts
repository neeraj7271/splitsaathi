import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FriendBalanceStatus = 'owes_you' | 'you_owe' | 'settled' | 'no_expenses';

export class FriendSharedGroupDto {
  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty({ description: 'Pairwise net in this group from current user view. >0 friend owes you.' })
  pairNetMinor!: number;

  @ApiProperty({ example: 'INR' })
  currencyCode!: string;
}

export class FriendSummaryDto {
  @ApiProperty({ format: 'uuid' })
  otherUserId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ example: 'INR' })
  currencyCode!: string;

  @ApiProperty({ description: '>0 friend owes you; <0 you owe friend.' })
  netMinor!: number;

  @ApiProperty({ enum: ['owes_you', 'you_owe', 'settled', 'no_expenses'] })
  status!: FriendBalanceStatus;

  @ApiProperty()
  sharedGroupCount!: number;

  @ApiProperty({ type: [FriendSharedGroupDto] })
  sharedGroups!: FriendSharedGroupDto[];
}

export class FriendTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['expense', 'settlement'] })
  kind!: 'expense' | 'settlement';

  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  occurredAt!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: 'Signed effect on pairwise net for current user.' })
  amountMinor!: number;

  @ApiProperty({ example: 'INR' })
  currencyCode!: string;

  @ApiPropertyOptional()
  expenseId?: string;

  @ApiPropertyOptional()
  settlementIntentId?: string;
}

export class FriendDetailDto {
  @ApiProperty({ type: FriendSummaryDto })
  friend!: FriendSummaryDto;

  @ApiProperty({ type: [FriendTransactionDto] })
  transactions!: FriendTransactionDto[];
}

export class RemindFriendResponseDto {
  @ApiProperty({ format: 'uuid' })
  notificationId!: string;

  @ApiProperty()
  delivered!: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';

export class ObligationTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromMembershipId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toMembershipId!: string;

  @ApiProperty({ example: 12500 })
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @ApiProperty({ example: 'INR' })
  @IsString()
  @Length(3, 3)
  currencyCode!: string;

  @ApiProperty({ required: false, example: 'Move-out settlement handoff.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  phoneHash!: string;

  @ApiPropertyOptional({ example: 'Priya Shah' })
  displayName?: string | null;

  @ApiProperty({ example: 'contacts_import' })
  source!: string;

  @ApiProperty()
  onSplitSaathi!: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  matchedUserId?: string | null;

  @ApiPropertyOptional({ example: 'Rahul Verma' })
  matchedDisplayName?: string | null;
}

export class ImportContactsResponseDto {
  @ApiProperty()
  importedCount!: number;

  @ApiProperty()
  matchedOnSplitSaathi!: number;
}

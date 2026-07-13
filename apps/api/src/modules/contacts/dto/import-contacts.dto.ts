import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class ImportContactEntryDto {
  @ApiProperty({ example: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' })
  @IsString()
  @Length(64, 64)
  phoneHash!: string;

  @ApiPropertyOptional({ example: 'Priya Shah' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}

export class ImportContactsDto {
  @ApiProperty({ type: ImportContactEntryDto, isArray: true })
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportContactEntryDto)
  contacts!: ImportContactEntryDto[];
}

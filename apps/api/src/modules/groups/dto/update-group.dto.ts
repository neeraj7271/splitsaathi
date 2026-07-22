import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Indiranagar Flat' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Attachment id with purpose group_image, or null to remove the logo.'
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  imageAttachmentId?: string | null;
}

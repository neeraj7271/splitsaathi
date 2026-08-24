import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ReplyTicketDto {
  @ApiProperty({ example: 'Thank you for reaching out. We have resolved your issue.', description: 'Reply message text' })
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ example: 'resolved', enum: ['open', 'in_progress', 'resolved', 'closed'], description: 'Ticket status' })
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status!: string;
}

export class RetryJobDto {
  @ApiProperty({ example: 'import', enum: ['import', 'export'], description: 'Job type' })
  @IsIn(['import', 'export'])
  type!: 'import' | 'export';
}

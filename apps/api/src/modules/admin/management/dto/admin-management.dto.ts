import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { AdminRole, AdminUserStatus } from '@splitsaathi/db';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'ops@thesplitsaathi.com', description: 'Admin user email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ops Manager', description: 'Full name of admin user' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Initial password' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'ops_admin', enum: ['super_admin', 'ops_admin', 'finance_admin', 'read_only'], description: 'Admin role' })
  @IsIn(['super_admin', 'ops_admin', 'finance_admin', 'read_only'])
  role!: AdminRole;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'finance_admin', enum: ['super_admin', 'ops_admin', 'finance_admin', 'read_only'], description: 'Updated role' })
  @IsOptional()
  @IsIn(['super_admin', 'ops_admin', 'finance_admin', 'read_only'])
  role?: AdminRole;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'suspended'], description: 'Updated account status' })
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: AdminUserStatus;
}

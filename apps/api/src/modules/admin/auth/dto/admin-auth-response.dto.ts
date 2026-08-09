import { ApiProperty } from '@nestjs/swagger';
import type { AdminRole, AdminUserStatus } from '@splitsaathi/db';

export class AdminUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  role!: AdminRole;

  @ApiProperty()
  status!: AdminUserStatus;

  @ApiProperty({ nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AdminAuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  tokenType!: string;

  @ApiProperty()
  expiresInSeconds!: number;

  @ApiProperty({ type: AdminUserDto })
  admin!: AdminUserDto;
}

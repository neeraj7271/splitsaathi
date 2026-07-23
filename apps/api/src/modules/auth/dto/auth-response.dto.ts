import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;

  @ApiProperty({
    description: 'True when the user still needs profile name and consent setup after OTP.'
  })
  needsOnboarding!: boolean;

  @ApiProperty({
    description: 'True when the authenticated user does not yet have a linked phone identity.'
  })
  needsPhoneLink!: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Optional phone hint from Google (rare). Used to prefill signup.'
  })
  suggestedPhoneE164?: string | null;
}

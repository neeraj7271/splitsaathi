import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OtpChallengeStatus = 'pending' | 'verified' | 'failed' | 'expired';

@Entity({ name: 'otp_challenges' })
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_e164', type: 'varchar', length: 20 })
  phoneE164!: string;

  @Column({ name: 'provider_challenge_id', type: 'varchar', length: 120 })
  providerChallengeId!: string;

  @Column({ type: 'varchar', length: 24, default: 'login' })
  purpose!: 'login';

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: OtpChallengeStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EmailOtpPurpose = 'signup' | 'password_reset';
export type EmailOtpStatus = 'pending' | 'verified' | 'failed' | 'expired';

@Entity({ name: 'email_otp_challenges' })
@Index(['email', 'purpose', 'createdAt'])
export class EmailOtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 24 })
  purpose!: EmailOtpPurpose;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 80, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: EmailOtpStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'resend_available_at', type: 'timestamptz' })
  resendAvailableAt!: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

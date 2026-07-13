import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AuthIdentityProvider = 'phone' | 'google';

@Entity({ name: 'auth_identities' })
@Index(['provider', 'identifier'], { unique: true })
export class AuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 24 })
  provider!: AuthIdentityProvider;

  @Column({ type: 'varchar', length: 120 })
  identifier!: string;

  @Column({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

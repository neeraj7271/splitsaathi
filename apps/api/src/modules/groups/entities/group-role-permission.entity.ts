import { MembershipRole } from '@splitsaathi/contracts';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { GroupPermission } from '../policies/group-permissions';

@Entity({ name: 'group_role_permissions' })
@Index(['groupId', 'role', 'permission'], { unique: true })
export class GroupRolePermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'varchar', length: 24 })
  role!: MembershipRole;

  @Column({ type: 'varchar', length: 80 })
  permission!: GroupPermission;

  @Column({ type: 'boolean', default: true })
  allowed!: boolean;
}

import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ApiConfigService } from '../src/config/api-config.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { GroupInviteEntity } from '../src/modules/groups/entities/group-invite.entity';
import { GroupMembershipEntity } from '../src/modules/groups/entities/group-membership.entity';
import { GroupRolePermissionEntity } from '../src/modules/groups/entities/group-role-permission.entity';
import { GroupEntity } from '../src/modules/groups/entities/group.entity';
import { ParticipantEntity } from '../src/modules/groups/entities/participant.entity';
import { GroupsController } from '../src/modules/groups/groups.controller';
import { GroupsService } from '../src/modules/groups/groups.service';
import { OBLIGATION_TRANSFER_PORT } from '../src/modules/groups/ports/obligation-transfer.port';
import { NoopObligationTransferProvider } from '../src/modules/groups/providers/noop-obligation-transfer.provider';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { UsersService } from '../src/modules/users/users.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { InMemoryRepository } from './support/in-memory-repository';

describe('groups endpoints', () => {
  let app: INestApplication;
  const userId = '11111111-1111-4111-8111-111111111111';
  const userRepository = new InMemoryRepository<UserEntity>([
    {
      id: userId,
      displayName: 'Priya Shah',
      defaultCurrencyCode: 'INR',
      state: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  const groupRepository = new InMemoryRepository<GroupEntity>();
  const participantRepository = new InMemoryRepository<ParticipantEntity>();
  const membershipRepository = new InMemoryRepository<GroupMembershipEntity>();
  const rolePermissionRepository = new InMemoryRepository<GroupRolePermissionEntity>();
  const inviteRepository = new InMemoryRepository<GroupInviteEntity>();

  class TestAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      request.user = { userId, phoneE164: '+919876543210' };
      return true;
    }
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/splitsaathi_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
    process.env.OTP_DEV_CODE = '123456';
    process.env.APP_PUBLIC_URL = 'http://localhost:3000';
    process.env.MOBILE_API_URL = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [
        ApiConfigService,
        GroupsService,
        UsersService,
        NoopObligationTransferProvider,
        {
          provide: OBLIGATION_TRANSFER_PORT,
          useExisting: NoopObligationTransferProvider
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn() }
        },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(ParticipantEntity), useValue: participantRepository },
        { provide: getRepositoryToken(GroupMembershipEntity), useValue: membershipRepository },
        { provide: getRepositoryToken(GroupRolePermissionEntity), useValue: rolePermissionRepository },
        { provide: getRepositoryToken(GroupInviteEntity), useValue: inviteRepository }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a group with owner membership and guest participant', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/groups')
      .send({
        name: 'Indiranagar Flat',
        mode: 'flat',
        participants: [{ displayName: 'Rahul', role: 'member' }]
      })
      .expect(201);

    expect(response.body.name).toBe('Indiranagar Flat');
    expect(response.body.participants).toHaveLength(2);
    expect(response.body.memberships.some((membership: any) => membership.role === 'owner')).toBe(true);
  });

  it('creates an invite and exposes a join URL', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/groups')
      .send({ name: 'Goa Trip', mode: 'trip' });

    const invite = await request(app.getHttpServer())
      .post(`/v1/groups/${created.body.id}/invites`)
      .send({ expiresInDays: 7, maxUses: 12 })
      .expect(201);

    expect(invite.body.token).toBeDefined();
    expect(invite.body.joinUrl).toContain('/join/');
    expect(invite.body.maxUses).toBe(12);

    await request(app.getHttpServer())
      .get(`/v1/groups/invites/${invite.body.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.groupId).toBe(created.body.id);
      });

    await request(app.getHttpServer())
      .post(`/v1/groups/invites/${invite.body.token}/claim`)
      .send({ displayName: 'Priya Invite' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
        expect(body.memberships.some((membership: any) => membership.userId === userId)).toBe(true);
      });
  });

  it('lists, details, adds participants, changes roles, locks exits, and archives groups', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/groups')
      .send({ name: 'Route Managed Flat', mode: 'flat' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/groups')
      .expect(200)
      .expect(({ body }) => {
        expect(body.some((group: any) => group.id === created.body.id && group.currentUserRole === 'owner')).toBe(true);
      });

    await request(app.getHttpServer())
      .get(`/v1/groups/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
        expect(body.participants).toHaveLength(1);
      });

    const added = await request(app.getHttpServer())
      .post(`/v1/groups/${created.body.id}/participants`)
      .send({ displayName: 'Neha', role: 'member' })
      .expect(201);
    expect(added.body).toMatchObject({ displayName: 'Neha', kind: 'guest' });

    const afterAdd = await request(app.getHttpServer())
      .get(`/v1/groups/${created.body.id}`)
      .expect(200);
    const addedMembership = afterAdd.body.memberships.find((membership: any) => membership.participantId === added.body.id);
    expect(addedMembership).toMatchObject({ role: 'member', status: 'active' });

    await request(app.getHttpServer())
      .patch(`/v1/groups/${created.body.id}/memberships/${addedMembership.id}/role`)
      .send({ role: 'admin' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: addedMembership.id, role: 'admin' });
      });

    await request(app.getHttpServer())
      .post(`/v1/groups/${created.body.id}/memberships/${addedMembership.id}/lock-exit`)
      .send({ reason: 'Moved out before balances were settled.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: addedMembership.id, status: 'locked_for_exit' });
        expect(body.lockedAt).toBeTruthy();
      });

    const refreshed = await request(app.getHttpServer())
      .get(`/v1/groups/${created.body.id}`)
      .expect(200);
    const ownerMembership = refreshed.body.memberships.find((membership: any) => membership.role === 'owner');

    await request(app.getHttpServer())
      .post(`/v1/groups/${created.body.id}/obligation-transfers`)
      .send({
        fromMembershipId: addedMembership.id,
        toMembershipId: ownerMembership.id,
        amountMinor: 2500,
        currencyCode: 'INR',
        reason: 'Move-out adjustment'
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'requires_ledger_module'
        });
        expect(body.message).toContain('requires the Ledger module');
      });

    await request(app.getHttpServer())
      .post(`/v1/groups/${created.body.id}/archive`)
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.state).toBe('archived');
        expect(body.archivedAt).toBeTruthy();
      });
  });
});

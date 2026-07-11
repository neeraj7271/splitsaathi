import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ApiConfigService } from '../src/config/api-config.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { OTP_PROVIDER } from '../src/modules/auth/auth.constants';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthIdentityEntity } from '../src/modules/auth/entities/auth-identity.entity';
import { OtpChallengeEntity } from '../src/modules/auth/entities/otp-challenge.entity';
import { RefreshSessionEntity } from '../src/modules/auth/entities/refresh-session.entity';
import { DevOtpProvider } from '../src/modules/auth/providers/dev-otp.provider';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';
import { InMemoryRepository } from './support/in-memory-repository';

describe('auth endpoints', () => {
  let app: INestApplication;
  const userRepository = new InMemoryRepository<UserEntity>();
  const identityRepository = new InMemoryRepository<AuthIdentityEntity>();
  const challengeRepository = new InMemoryRepository<OtpChallengeEntity>();
  const refreshSessionRepository = new InMemoryRepository<RefreshSessionEntity>();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/splitsaathi_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
    process.env.OTP_DEV_CODE = '123456';
    process.env.APP_PUBLIC_URL = 'http://localhost:3000';
    process.env.MOBILE_API_URL = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        ApiConfigService,
        AuthService,
        UsersService,
        DevOtpProvider,
        JwtService,
        { provide: OTP_PROVIDER, useExisting: DevOtpProvider },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: getRepositoryToken(AuthIdentityEntity), useValue: identityRepository },
        { provide: getRepositoryToken(OtpChallengeEntity), useValue: challengeRepository },
        { provide: getRepositoryToken(RefreshSessionEntity), useValue: refreshSessionRepository }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts and verifies a development OTP challenge', async () => {
    const start = await request(app.getHttpServer())
      .post('/v1/auth/otp/start')
      .send({ phoneE164: '+919876543210' })
      .expect(201);

    expect(start.body.challengeId).toBeDefined();
    expect(start.body.devCode).toBe('123456');

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({
        challengeId: start.body.challengeId,
        code: '123456',
        displayName: 'Priya Shah'
      })
      .expect(200);

    expect(verify.body.user.displayName).toBe('Priya Shah');
    expect(verify.body.tokens.accessToken).toBeDefined();
    expect(verify.body.tokens.refreshToken).toBeDefined();
  });

  it('rotates refresh sessions', async () => {
    const start = await request(app.getHttpServer())
      .post('/v1/auth/otp/start')
      .send({ phoneE164: '+919876543211' });
    const verify = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: start.body.challengeId, code: '123456' });

    const refresh = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: verify.body.tokens.refreshToken })
      .expect(200);

    expect(refresh.body.tokens.refreshToken).toBeDefined();
    expect(refresh.body.tokens.refreshToken).not.toBe(verify.body.tokens.refreshToken);
  });

  it('rejects incorrect OTP codes and records attempts', async () => {
    const start = await request(app.getHttpServer())
      .post('/v1/auth/otp/start')
      .send({ phoneE164: '+919876543212' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: start.body.challengeId, code: '000000' })
      .expect(401);

    const challenge = challengeRepository.all().find((row) => row.id === start.body.challengeId);
    expect(challenge?.attempts).toBe(1);
    expect(challenge?.status).toBe('pending');
  });

  it('expires stale OTP challenges before provider verification', async () => {
    const start = await request(app.getHttpServer())
      .post('/v1/auth/otp/start')
      .send({ phoneE164: '+919876543213' })
      .expect(201);
    const challenge = challengeRepository.all().find((row) => row.id === start.body.challengeId);
    expect(challenge).toBeDefined();
    await challengeRepository.save({
      ...challenge!,
      expiresAt: new Date(Date.now() - 1000)
    });

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: start.body.challengeId, code: '123456' })
      .expect(401);

    expect(challengeRepository.all().find((row) => row.id === start.body.challengeId)?.status).toBe('expired');
  });

  it('rejects invalid refresh tokens', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-refresh-token-with-enough-length' })
      .expect(401);
  });
});

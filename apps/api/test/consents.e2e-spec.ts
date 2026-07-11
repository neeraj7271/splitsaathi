import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentRecordEntity } from '@splitsaathi/db';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ConsentsController } from '../src/modules/consents/consents.controller';
import { ConsentsService } from '../src/modules/consents/consents.service';
import { InMemoryRepository } from './support/in-memory-repository';

describe('consent endpoints', () => {
  let app: INestApplication;
  const userId = '55555555-5555-4555-8555-555555555555';
  const consentRepository = new InMemoryRepository<ConsentRecordEntity>();

  class TestAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const requestContext = context.switchToHttp().getRequest();
      requestContext.user = { userId, phoneE164: '+919876543210' };
      return true;
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConsentsController],
      providers: [
        ConsentsService,
        { provide: getRepositoryToken(ConsentRecordEntity), useValue: consentRepository }
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

  it('records and lists consent decisions for the authenticated user', async () => {
    const recorded = await request(app.getHttpServer())
      .post('/v1/consents')
      .send({
        purpose: 'contacts_discovery',
        status: 'granted',
        source: 'mobile',
        metadata: { screen: 'onboarding' }
      })
      .expect(201);

    expect(recorded.body).toMatchObject({
      userId,
      purpose: 'contacts_discovery',
      status: 'granted',
      source: 'onboarding',
      metadata: { screen: 'onboarding' }
    });

    await request(app.getHttpServer())
      .get('/v1/consents')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].purpose).toBe('contacts_discovery');
      });
  });
});

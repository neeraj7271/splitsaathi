import 'reflect-metadata';
import { resolve } from 'node:path';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ApiConfigService } from './config/api-config.service';
import { loadEnvFile } from './config/load-env-file';
import { setupSwagger } from './swagger/setup-swagger';

// Load apps/api/.env when present (PM2/systemd can also inject env).
loadEnvFile(resolve(__dirname, '../.env'));

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ApiConfigService);

  app.use(
    json({
      verify: (request: any, _response, buffer) => {
        request.rawBody = buffer.toString('utf8');
      }
    })
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (request: any, _response, buffer) => {
        request.rawBody = buffer.toString('utf8');
      }
    })
  );

  app.enableCors({
    origin: true,
    credentials: true
  });
  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'join/:token', method: RequestMethod.GET }]
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  setupSwagger(app);

  const host = config.env.HOST;
  await app.listen(config.env.PORT, host);
}

void bootstrap();

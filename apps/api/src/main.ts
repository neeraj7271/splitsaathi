import 'reflect-metadata';
import { resolve } from 'node:path';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import express, { json, NextFunction, Request, Response, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ApiConfigService } from './config/api-config.service';
import { loadEnvFile } from './config/load-env-file';
import { setupSwagger } from './swagger/setup-swagger';

// Load apps/api/.env when present (PM2/systemd can also inject env).
loadEnvFile(resolve(__dirname, '../.env'));

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ApiConfigService);

  app.use(
    '/brand',
    express.static(resolve(__dirname, '../assets/brand'), {
      maxAge: '7d',
      immutable: true
    })
  );
  const downloadsDir = process.env.APK_DOWNLOADS_DIR || '/var/www/downloads';
  app.use('/downloads', (request: Request, response: Response, next: NextFunction) => {
    if (request.path.toLowerCase().endsWith('.apk')) {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
    }
    next();
  });
  app.use(
    '/downloads',
    express.static(downloadsDir, {
      maxAge: 0,
      etag: true,
      lastModified: true
    })
  );
  const jsonLimit = process.env.JSON_BODY_LIMIT || '5mb';
  app.use(
    json({
      limit: jsonLimit,
      verify: (request: any, _response, buffer) => {
        request.rawBody = buffer.toString('utf8');
      }
    })
  );
  app.use(
    urlencoded({
      extended: true,
      limit: jsonLimit,
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
    exclude: [
      { path: 'join/:token', method: RequestMethod.GET },
      { path: '.well-known/assetlinks.json', method: RequestMethod.GET }
    ]
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

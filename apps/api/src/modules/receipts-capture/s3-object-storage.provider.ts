import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { ApiConfigService } from '../../config/api-config.service';
import type { ObjectStoragePort, PutObjectInput, PutObjectResult } from './object-storage.port';

type MinioLike = Pick<Client, 'putObject' | 'getObject'>;

@Injectable()
export class S3ObjectStorageProvider implements ObjectStoragePort {
  private client?: MinioLike;

  constructor(private readonly config: ApiConfigService) {}

  static withClient(config: ApiConfigService, client: MinioLike): S3ObjectStorageProvider {
    const provider = new S3ObjectStorageProvider(config);
    provider.client = client;
    return provider;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const bucket = this.requireBucket();
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const extension = path.extname(input.originalName ?? '').toLowerCase();
    const storageKey = path.posix.join(
      'attachments',
      input.ownerUserId,
      normalizeKeySegment(input.purpose),
      `${sha256.slice(0, 12)}-${randomUUID()}${extension}`
    );
    await this.clientForUse().putObject(bucket, storageKey, input.buffer, input.buffer.length, {
      'Content-Type': input.mimeType,
      'X-Amz-Meta-Sha256': sha256
    });
    return {
      storageProvider: 's3-compatible',
      storageKey,
      byteSize: input.buffer.length,
      sha256
    };
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const stream = await this.clientForUse().getObject(this.requireBucket(), storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private createClient(): Client {
    const endpoint = this.config.env.S3_ENDPOINT;
    const accessKey = this.config.env.S3_ACCESS_KEY_ID;
    const secretKey = this.config.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKey || !secretKey) {
      throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when OBJECT_STORAGE_DRIVER=s3.');
    }
    const url = endpoint.startsWith('http') ? new URL(endpoint) : new URL(`https://${endpoint}`);
    const useSSL =
      url.protocol === 'http:'
        ? false
        : url.protocol === 'https:'
          ? true
          : this.config.env.S3_USE_SSL;
    return new Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : useSSL ? 443 : 80,
      useSSL,
      accessKey,
      secretKey,
      region: this.config.env.S3_REGION
    });
  }

  private clientForUse(): MinioLike {
    this.client ??= this.createClient();
    return this.client;
  }

  private requireBucket(): string {
    if (!this.config.env.S3_BUCKET) {
      throw new Error('S3_BUCKET is required when OBJECT_STORAGE_DRIVER=s3.');
    }
    return this.config.env.S3_BUCKET;
  }
}

function normalizeKeySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'attachment';
}

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import type { ObjectStoragePort, PutObjectInput, PutObjectResult } from './object-storage.port';

@Injectable()
export class LocalObjectStorageProvider implements ObjectStoragePort {
  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const extension = path.extname(input.originalName ?? '').toLowerCase();
    const fileName = `${randomUUID()}${extension}`;
    const key = path.posix.join(
      'attachments',
      input.ownerUserId,
      normalizeKeySegment(input.purpose),
      `${sha256.slice(0, 12)}-${fileName}`
    );
    const absolutePath = path.join(this.rootDir, ...key.split('/'));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    // Persist the exact uploaded bytes; metadata-only attachment rows cannot support audit evidence or future OCR.
    await writeFile(absolutePath, input.buffer, { flag: 'wx' });
    return {
      storageProvider: 'local-filesystem',
      storageKey: key,
      byteSize: input.buffer.length,
      sha256
    };
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const resolved = path.resolve(this.rootDir, ...storageKey.split('/'));
    const root = path.resolve(this.rootDir);
    if (!resolved.startsWith(root)) {
      throw new Error('Storage key resolves outside the local object-storage root.');
    }
    return readFile(resolved);
  }

  private get rootDir(): string {
    return process.env.LOCAL_OBJECT_STORAGE_DIR ?? path.join(process.cwd(), '.local-storage');
  }
}

function normalizeKeySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'attachment';
}

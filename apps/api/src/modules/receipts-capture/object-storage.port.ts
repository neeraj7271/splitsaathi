export const OBJECT_STORAGE_PROVIDER = 'OBJECT_STORAGE_PROVIDER';

export type ObjectStorageProviderName = 'local-filesystem' | 's3-compatible';

export interface PutObjectInput {
  ownerUserId: string;
  purpose: string;
  originalName?: string;
  mimeType: string;
  buffer: Buffer;
}

export interface PutObjectResult {
  storageProvider: ObjectStorageProviderName;
  storageKey: string;
  byteSize: number;
  sha256: string;
}

export interface ObjectStoragePort {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObjectBuffer?(storageKey: string): Promise<Buffer>;
}

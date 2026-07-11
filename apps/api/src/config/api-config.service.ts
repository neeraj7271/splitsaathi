import { Injectable } from '@nestjs/common';
import { AppEnv, loadEnv } from '@splitsaathi/config';

@Injectable()
export class ApiConfigService {
  readonly env: AppEnv;

  constructor() {
    this.env = loadEnv(process.env);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}

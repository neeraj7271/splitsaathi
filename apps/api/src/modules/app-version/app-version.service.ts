import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';

export interface AppVersionResponse {
  latestVersionName: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  updateAvailable: boolean;
  forceUpdate: boolean;
  directApkUrl: string;
  playStoreUrl: string;
  releaseNotes: string;
  releasedAt: string;
}

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);

  getVersionInfo(clientVersionCode?: number): AppVersionResponse {
    const versionData = this.loadVersionConfig();
    const clientCode = clientVersionCode ?? 0;

    const updateAvailable = clientCode > 0 && clientCode < versionData.versionCode;
    const forceUpdate = clientCode > 0 && clientCode < versionData.minSupportedVersionCode;

    return {
      latestVersionName: versionData.versionName,
      latestVersionCode: versionData.versionCode,
      minSupportedVersionCode: versionData.minSupportedVersionCode,
      updateAvailable,
      forceUpdate,
      directApkUrl: versionData.directApkUrl,
      playStoreUrl: versionData.playStoreUrl,
      releaseNotes: versionData.releaseNotes,
      releasedAt: versionData.releasedAt
    };
  }

  private loadVersionConfig() {
    try {
      const candidates = [
        path.join(process.cwd(), 'apps/mobile/version.json'),
        path.join(process.cwd(), '../mobile/version.json'),
        path.join(__dirname, '../../../mobile/version.json')
      ];

      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(raw);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read version.json, using fallback defaults: ${error}`);
    }

    return {
      versionName: '0.1.0',
      versionCode: 100,
      minSupportedVersionCode: 100,
      directApkUrl: 'https://api-dev.thesplitsaathi.com/downloads/SplitSaathi-debug.apk',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=in.splitsaathi.mobile',
      releaseNotes: 'Initial release with expense splitting and settlement tracking.',
      releasedAt: '2026-08-12'
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAppConfigEntity } from '@splitsaathi/db';
import fs from 'node:fs';
import path from 'node:path';
import { BroadcastUpdateDto } from './dto/broadcast-update.dto';

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

  constructor(
    @InjectRepository(AdminAppConfigEntity)
    private readonly configRepo: Repository<AdminAppConfigEntity>
  ) {}

  async getVersionInfo(clientVersionCode?: number): Promise<AppVersionResponse> {
    const defaultData = this.loadVersionConfig();
    const clientCode = clientVersionCode ?? 0;

    // Check DB for platform = android override
    let dbConfig: AdminAppConfigEntity | null = null;
    try {
      dbConfig = await this.configRepo.findOne({ where: { platform: 'android' } });
    } catch {
      // Fallback gracefully to version.json file if DB lookup fails
    }

    const latestVersionName = dbConfig?.latestVersion || defaultData.versionName;
    const latestVersionCode = dbConfig
      ? parseVersionCode(dbConfig.latestVersion, defaultData.versionCode)
      : defaultData.versionCode;
    const minSupportedVersionCode = dbConfig
      ? parseVersionCode(dbConfig.minSupportedVersion, defaultData.minSupportedVersionCode)
      : defaultData.minSupportedVersionCode;

    const forceUpdateEnabled = dbConfig?.forceUpdateEnabled ?? false;

    const updateAvailable = clientCode > 0 && clientCode < latestVersionCode;
    const forceUpdate =
      clientCode > 0
        ? (forceUpdateEnabled && clientCode < latestVersionCode) || clientCode < minSupportedVersionCode
        : forceUpdateEnabled;

    return {
      latestVersionName,
      latestVersionCode,
      minSupportedVersionCode,
      updateAvailable,
      forceUpdate,
      directApkUrl: defaultData.directApkUrl,
      playStoreUrl: defaultData.playStoreUrl,
      releaseNotes: dbConfig?.changelog || defaultData.releaseNotes,
      releasedAt: defaultData.releasedAt
    };
  }

  async updateVersionConfig(dto: BroadcastUpdateDto): Promise<AdminAppConfigEntity> {
    const versionName = dto.versionName ?? '1.0.1';
    const minVersion = dto.forceUpdate ? versionName : '1.0.0';

    let config = await this.configRepo.findOne({ where: { platform: 'android' } });
    if (!config) {
      config = this.configRepo.create({
        platform: 'android',
        latestVersion: versionName,
        minSupportedVersion: minVersion,
        forceUpdateEnabled: dto.forceUpdate ?? false,
        changelog: dto.releaseNotes || 'New updates and bug fixes.'
      });
    } else {
      config.latestVersion = versionName;
      if (dto.forceUpdate) {
        config.minSupportedVersion = versionName;
        config.forceUpdateEnabled = true;
      }
      if (dto.releaseNotes) {
        config.changelog = dto.releaseNotes;
      }
    }

    const saved = await this.configRepo.save(config);
    this.logger.log(`Updated Android App Config in DB: latestVersion=${saved.latestVersion}`);
    return saved;
  }

  private loadVersionConfig() {
    try {
      const candidates = [
        path.join(process.cwd(), 'apps/mobile/version.json'),
        path.join(process.cwd(), '../mobile/version.json'),
        path.join(__dirname, '../../../mobile/version.json')
      ];

      for (const filePath of candidates) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(raw);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read version.json, using fallback defaults: ${error}`);
    }

    return {
      versionName: '1.0.0',
      versionCode: 100,
      minSupportedVersionCode: 100,
      directApkUrl: 'https://api.thesplitsaathi.com/downloads/SplitSaathi.apk',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=in.splitsaathi.mobile',
      releaseNotes: 'Official release of SplitSaathi with expense tracking and UPI settlements.',
      releasedAt: '2026-08-24'
    };
  }
}

function parseVersionCode(versionStr: string, fallback: number): number {
  if (!versionStr) return fallback;
  // e.g. "1.0.1" => 101, "1.2.0" => 120, "2.0.0" => 200
  const parts = versionStr.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length >= 3 && !parts.some(Number.isNaN)) {
    return parts[0] * 100 + parts[1] * 10 + parts[2];
  }
  const parsed = Number.parseInt(versionStr.replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

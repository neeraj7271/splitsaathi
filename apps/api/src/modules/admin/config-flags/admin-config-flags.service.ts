import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminFeatureFlagEntity, AdminAppConfigEntity } from '@splitsaathi/db';

export interface UpsertFeatureFlagPayload {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  targetPlatforms?: string[];
  minAppVersion?: string;
}

export interface UpdateAppConfigPayload {
  platform: string;
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdateEnabled: boolean;
  changelog?: string;
}

@Injectable()
export class AdminConfigFlagsService {
  constructor(
    @InjectRepository(AdminFeatureFlagEntity)
    private readonly flagRepo: Repository<AdminFeatureFlagEntity>,
    @InjectRepository(AdminAppConfigEntity)
    private readonly configRepo: Repository<AdminAppConfigEntity>
  ) {}

  async listFeatureFlags() {
    return this.flagRepo.find({ order: { createdAt: 'DESC' } });
  }

  async upsertFeatureFlag(payload: UpsertFeatureFlagPayload, adminId: string) {
    let flag = await this.flagRepo.findOne({ where: { key: payload.key } });

    if (!flag) {
      flag = this.flagRepo.create({
        key: payload.key,
        description: payload.description,
        enabled: payload.enabled,
        rolloutPercentage: payload.rolloutPercentage ?? 100,
        targetPlatforms: payload.targetPlatforms ?? [],
        minAppVersion: payload.minAppVersion || null,
        updatedByAdminId: adminId
      });
    } else {
      flag.description = payload.description;
      flag.enabled = payload.enabled;
      if (payload.rolloutPercentage !== undefined) flag.rolloutPercentage = payload.rolloutPercentage;
      if (payload.targetPlatforms !== undefined) flag.targetPlatforms = payload.targetPlatforms;
      if (payload.minAppVersion !== undefined) flag.minAppVersion = payload.minAppVersion;
      flag.updatedByAdminId = adminId;
    }

    return this.flagRepo.save(flag);
  }

  async deleteFeatureFlag(key: string) {
    const flag = await this.flagRepo.findOne({ where: { key } });
    if (!flag) {
      throw new NotFoundException('Feature flag not found.');
    }
    await this.flagRepo.remove(flag);
    return { success: true, message: `Feature flag ${key} deleted.` };
  }

  async getAppConfigs() {
    return this.configRepo.find();
  }

  async updateAppConfig(payload: UpdateAppConfigPayload, adminId: string) {
    let config = await this.configRepo.findOne({ where: { platform: payload.platform } });

    if (!config) {
      config = this.configRepo.create({
        platform: payload.platform,
        minSupportedVersion: payload.minSupportedVersion,
        latestVersion: payload.latestVersion,
        forceUpdateEnabled: payload.forceUpdateEnabled,
        changelog: payload.changelog || null,
        updatedByAdminId: adminId
      });
    } else {
      config.minSupportedVersion = payload.minSupportedVersion;
      config.latestVersion = payload.latestVersion;
      config.forceUpdateEnabled = payload.forceUpdateEnabled;
      if (payload.changelog !== undefined) config.changelog = payload.changelog;
      config.updatedByAdminId = adminId;
    }

    return this.configRepo.save(config);
  }
}

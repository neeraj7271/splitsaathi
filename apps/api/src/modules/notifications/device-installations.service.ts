import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceInstallationEntity } from '@splitsaathi/db';
import { Repository } from 'typeorm';

@Injectable()
export class DeviceInstallationsService {
  constructor(
    @InjectRepository(DeviceInstallationEntity)
    private readonly devices: Repository<DeviceInstallationEntity>
  ) {}

  async register(input: {
    userId: string;
    platform: 'ios' | 'android';
    appVersion: string;
    pushToken?: string;
  }) {
    const existing = input.pushToken
      ? await this.devices.findOne({ where: { userId: input.userId, pushToken: input.pushToken } })
      : undefined;
    const row =
      existing ??
      this.devices.create({
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion,
        pushToken: input.pushToken ?? null
      });
    row.lastSeenAt = new Date();
    row.appVersion = input.appVersion;
    return this.devices.save(row);
  }

  async listPushTokens(userId: string): Promise<string[]> {
    const rows = await this.devices.find({ where: { userId } });
    return rows.map((row) => row.pushToken).filter((token): token is string => Boolean(token));
  }
}

import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContactAliasEntity } from '@splitsaathi/db';
import { In, Repository } from 'typeorm';
import { ApiConfigService } from '../../config/api-config.service';
import { hashPhoneE164, phoneHashPepper } from '../../common/utils/phone-hash';
import { AuthIdentityEntity } from '../auth/entities/auth-identity.entity';
import { ConsentsService } from '../consents/consents.service';
import { UserEntity } from '../users/entities/user.entity';
import { ContactResponseDto, ImportContactsResponseDto } from './dto/contact-response.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactAliasEntity)
    private readonly aliases: Repository<ContactAliasEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly consents: ConsentsService,
    private readonly config: ApiConfigService
  ) {}

  async importContacts(userId: string, dto: ImportContactsDto): Promise<ImportContactsResponseDto> {
    await this.assertContactsConsent(userId);

    const uniqueByHash = new Map<string, string | undefined>();
    for (const entry of dto.contacts) {
      if (!uniqueByHash.has(entry.phoneHash)) {
        uniqueByHash.set(entry.phoneHash, entry.displayName?.trim() || undefined);
      }
    }

    const hashes = [...uniqueByHash.keys()];
    if (!hashes.length) {
      return { importedCount: 0, matchedOnSplitSaathi: 0 };
    }

    const existing = await this.aliases.find({
      where: { ownerUserId: userId, phoneHash: In(hashes) }
    });
    const existingHashes = new Set(existing.map((row) => row.phoneHash));

    const toCreate = hashes
      .filter((phoneHash) => !existingHashes.has(phoneHash))
      .map((phoneHash) =>
        this.aliases.create({
          ownerUserId: userId,
          phoneHash,
          displayName: uniqueByHash.get(phoneHash) ?? null,
          source: 'contacts_import'
        })
      );

    if (toCreate.length) {
      await this.aliases.save(toCreate);
    }

    for (const row of existing) {
      const displayName = uniqueByHash.get(row.phoneHash);
      if (displayName && displayName !== row.displayName) {
        row.displayName = displayName;
        await this.aliases.save(row);
      }
    }

    const matches = await this.buildMatchMap(hashes, userId);
    return {
      importedCount: hashes.length,
      matchedOnSplitSaathi: matches.size
    };
  }

  async listContacts(userId: string): Promise<ContactResponseDto[]> {
    const hasConsent = await this.consents.hasActiveConsent(userId, 'contacts_discovery');
    if (!hasConsent) {
      return [];
    }

    const rows = await this.aliases.find({
      where: { ownerUserId: userId },
      order: { displayName: 'ASC', createdAt: 'DESC' }
    });
    if (!rows.length) {
      return [];
    }

    const matches = await this.buildMatchMap(
      rows.map((row) => row.phoneHash),
      userId
    );

    return rows.map((row) => {
      const match = matches.get(row.phoneHash);
      return {
        id: row.id,
        phoneHash: row.phoneHash,
        displayName: row.displayName,
        source: row.source,
        onSplitSaathi: Boolean(match),
        matchedUserId: match?.userId ?? null,
        matchedDisplayName: match?.displayName ?? null
      };
    });
  }

  private async assertContactsConsent(userId: string) {
    const hasConsent = await this.consents.hasActiveConsent(userId, 'contacts_discovery');
    if (!hasConsent) {
      throw new ForbiddenException('Contacts discovery consent is required before importing contacts.');
    }
  }

  private async buildMatchMap(phoneHashes: string[], excludeUserId: string) {
    const hashSet = new Set(phoneHashes);
    const matches = new Map<string, { userId: string; displayName: string }>();
    if (!hashSet.size) {
      return matches;
    }

    const pepper = phoneHashPepper(this.config.env);
    const phoneIdentities = await this.identities.find({ where: { provider: 'phone' } });
    const matchedUserIds = new Set<string>();

    for (const identity of phoneIdentities) {
      if (identity.userId === excludeUserId) {
        continue;
      }
      const phoneHash = hashPhoneE164(identity.identifier, pepper);
      if (hashSet.has(phoneHash)) {
        matchedUserIds.add(identity.userId);
        matches.set(phoneHash, { userId: identity.userId, displayName: '' });
      }
    }

    if (!matchedUserIds.size) {
      return matches;
    }

    const users = await this.users.find({ where: { id: In([...matchedUserIds]) } });
    const displayNames = new Map(users.map((user) => [user.id, user.displayName]));

    for (const [phoneHash, match] of matches.entries()) {
      match.displayName = displayNames.get(match.userId) ?? 'SplitSaathi user';
      matches.set(phoneHash, match);
    }

    return matches;
  }
}

import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Digital Asset Links for Android App Links (Always / Just once open tray).
 * Served at https://api.thesplitsaathi.com/.well-known/assetlinks.json
 *
 * Fingerprint must match the APK signing cert. Current release builds use the
 * project debug keystore unless a production keystore is configured.
 */
@ApiExcludeController()
@Controller('.well-known')
export class WellKnownController {
  @Public()
  @Get('assetlinks.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=300')
  assetLinks() {
    const fingerprints = this.resolveFingerprints();
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'in.splitsaathi.mobile',
          sha256_cert_fingerprints: fingerprints
        }
      }
    ];
  }

  private resolveFingerprints(): string[] {
    const fromEnv = (process.env.ANDROID_APP_LINK_SHA256 ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (value.includes(':') ? value.toUpperCase() : formatSha256(value)));

    // Debug keystore used by current assembleRelease (signingConfigs.debug)
    const debugReleaseCert =
      'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

    const merged = [...fromEnv];
    if (!merged.includes(debugReleaseCert)) {
      merged.push(debugReleaseCert);
    }
    return merged;
  }
}

function formatSha256(hex: string): string {
  const clean = hex.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  return clean.match(/.{1,2}/g)?.join(':') ?? clean;
}

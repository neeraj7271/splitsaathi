import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiConfigService } from '../../config/api-config.service';
import { GroupsService } from './groups.service';

/**
 * Public invite landing page at /join/:token (outside /v1).
 * On Android, the primary CTA uses an https intent without a forced package so
 * the system can show the Open with / Always / Just once tray when SplitSaathi
 * is installed. Verified App Links (assetlinks.json) make WhatsApp/Chrome offer
 * that tray before this page even loads.
 */
@ApiExcludeController()
@Controller('join')
export class JoinLinkController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly config: ApiConfigService
  ) {}

  @Public()
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  async openInvite(@Param('token') token: string, @Res() response: Response): Promise<void> {
    const safeToken = token.trim();
    if (!safeToken || safeToken.length < 8 || /[^A-Za-z0-9_-]/.test(safeToken)) {
      throw new NotFoundException('Invite link is invalid.');
    }

    let valid = true;
    try {
      await this.groupsService.previewInvite(safeToken);
    } catch {
      valid = false;
    }

    const publicBase = this.config.env.APP_PUBLIC_URL.replace(/\/$/, '');
    const httpsJoin = `${publicBase}/join/${encodeURIComponent(safeToken)}`;
    const host = new URL(publicBase).host;
    const deepLink = `splitsaathi://join/${encodeURIComponent(safeToken)}`;
    // No package= → Android shows chooser (SplitSaathi vs browser) with Always / Just once.
    // No Play Store fallback.
    const androidChooserIntent = `intent://${host}/join/${encodeURIComponent(
      safeToken
    )}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

    response
      .status(valid ? 200 : 404)
      .type('html')
      .send(
        renderJoinPage({
          httpsJoin,
          deepLink,
          androidChooserIntent,
          valid
        })
      );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderJoinPage(input: {
  httpsJoin: string;
  deepLink: string;
  androidChooserIntent: string;
  valid: boolean;
}): string {
  const title = input.valid ? 'Join on SplitSaathi' : 'Invite unavailable';
  const body = input.valid
    ? 'If SplitSaathi is installed, Android will ask whether to open it — choose Always or Just once.'
    : 'This invite link is expired, used up, or invalid.';
  const chooser = escapeHtml(input.androidChooserIntent);
  const deep = escapeHtml(input.deepLink);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0B0E14" />
  <title>${escapeHtml(title)} · SplitSaathi</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(1200px 600px at 50% -10%, #1b2433 0%, #0B0E14 55%);
      color: #F4F6FA; padding: 24px;
    }
    .card {
      width: min(420px, 100%); background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px;
      text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    }
    h1 { margin: 0 0 8px; font-size: 1.45rem; letter-spacing: -0.02em; }
    p { margin: 0 0 20px; color: #A7B0C0; line-height: 1.45; }
    a.btn {
      display: block; text-decoration: none; color: #0B0E14; background: #7CFFB2;
      font-weight: 700; padding: 14px 22px; border-radius: 999px; margin: 10px 0;
      font-size: 1rem;
    }
    a.secondary {
      color: #7CFFB2; background: transparent; border: 1px solid rgba(124,255,178,0.35);
    }
    .hint { margin-top: 14px; font-size: 0.85rem; color: #7B8494; line-height: 1.45; text-align: left; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    ${
      input.valid
        ? `<a class="btn" id="open-chooser" href="${chooser}">Open with SplitSaathi</a>
           <a class="btn secondary" href="${deep}">Open app directly</a>
           <p class="hint">
             1. Tap <strong>Open with SplitSaathi</strong>.<br/>
             2. In the bottom tray, pick <strong>SplitSaathi</strong>.<br/>
             3. Choose <strong>Just once</strong> or <strong>Always</strong>.<br/>
             Install the SplitSaathi APK first if the app is not listed.
           </p>
           <script>
             (function () {
               var ua = navigator.userAgent || '';
               if (!/Android/i.test(ua)) return;
               // Soft prompt once — system tray handles Always / Just once.
               var target = ${JSON.stringify(input.androidChooserIntent)};
               window.setTimeout(function () { window.location.href = target; }, 600);
             })();
           </script>`
        : `<p class="hint">Ask the group admin to send a fresh invite.</p>`
    }
  </main>
</body>
</html>`;
}

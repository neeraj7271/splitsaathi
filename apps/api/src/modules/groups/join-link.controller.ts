import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { GroupsService } from './groups.service';

/**
 * Public invite landing page at /join/:token (outside /v1).
 *
 * Opens the sideloaded APK via custom scheme + package-targeted intent.
 * Do NOT auto-redirect to https intents (that reopens Chrome and flickers).
 * Android "Always / Just once" appears after App Links are verified via
 * /.well-known/assetlinks.json when the user taps the https invite from
 * WhatsApp/Messages — not from an in-page redirect loop.
 */
@ApiExcludeController()
@Controller('join')
export class JoinLinkController {
  constructor(private readonly groupsService: GroupsService) {}

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

    const deepLink = `splitsaathi://join/${encodeURIComponent(safeToken)}`;
    // package= forces the installed SplitSaathi APK (no Play Store, no Chrome loop).
    const openAppIntent = `intent://join/${encodeURIComponent(
      safeToken
    )}#Intent;scheme=splitsaathi;package=in.splitsaathi.mobile;end`;

    response
      .status(valid ? 200 : 404)
      .type('html')
      .send(renderJoinPage({ deepLink, openAppIntent, valid }));
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

function renderJoinPage(input: { deepLink: string; openAppIntent: string; valid: boolean }): string {
  const title = input.valid ? 'Join on SplitSaathi' : 'Invite unavailable';
  const body = input.valid
    ? 'SplitSaathi is installed on this phone — tap the button to open the invite in the app.'
    : 'This invite link is expired, used up, or invalid.';
  const intent = escapeHtml(input.openAppIntent);
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
      background: #0B0E14;
      color: #F4F6FA; padding: 24px;
    }
    .card {
      width: min(420px, 100%); background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px;
      text-align: center;
    }
    h1 { margin: 0 0 8px; font-size: 1.45rem; letter-spacing: -0.02em; }
    p { margin: 0 0 20px; color: #A7B0C0; line-height: 1.45; }
    a.btn {
      display: block; text-decoration: none; color: #0B0E14; background: #7CFFB2;
      font-weight: 700; padding: 16px 22px; border-radius: 999px; margin: 10px 0;
      font-size: 1.05rem;
    }
    a.secondary {
      color: #7CFFB2; background: transparent; border: 1px solid rgba(124,255,178,0.35);
    }
    .hint { margin-top: 16px; font-size: 0.85rem; color: #7B8494; line-height: 1.45; text-align: left; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    ${
      input.valid
        ? `<a class="btn" href="${intent}">Open SplitSaathi</a>
           <a class="btn secondary" href="${deep}">Try alternate open</a>
           <p class="hint">
             If nothing happens, install the SplitSaathi APK, then return here and tap Open again.
             Chrome may show a prompt — choose SplitSaathi.
           </p>`
        : `<p class="hint">Ask the group admin to send a fresh invite.</p>`
    }
  </main>
</body>
</html>`;
}

import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { GroupsService } from './groups.service';

/**
 * Public invite landing page at /join/:token (outside /v1).
 * Opens the Android/iOS app via deep link; falls back to install guidance.
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
    const androidIntent = `intent://join/${encodeURIComponent(safeToken)}#Intent;scheme=splitsaathi;package=in.splitsaathi.mobile;S.browser_fallback_url=${encodeURIComponent(
      'https://play.google.com/store/apps/details?id=in.splitsaathi.mobile'
    )};end`;

    response
      .status(valid ? 200 : 404)
      .type('html')
      .send(renderJoinPage({ deepLink, androidIntent, valid }));
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
  deepLink: string;
  androidIntent: string;
  valid: boolean;
}): string {
  const title = input.valid ? 'Open SplitSaathi' : 'Invite unavailable';
  const body = input.valid
    ? 'Opening the SplitSaathi app so you can join this group.'
    : 'This invite link is expired, used up, or invalid.';
  const deep = escapeHtml(input.deepLink);
  const intent = escapeHtml(input.androidIntent);

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
      display: inline-block; text-decoration: none; color: #0B0E14; background: #7CFFB2;
      font-weight: 700; padding: 12px 18px; border-radius: 999px; margin: 6px;
    }
    a.secondary { color: #7CFFB2; background: transparent; border: 1px solid rgba(124,255,178,0.35); }
    .hint { margin-top: 16px; font-size: 0.85rem; color: #7B8494; }
  </style>
  ${
    input.valid
      ? `<script>
    (function () {
      var deep = ${JSON.stringify(input.deepLink)};
      var intent = ${JSON.stringify(input.androidIntent)};
      var ua = navigator.userAgent || '';
      var target = /Android/i.test(ua) ? intent : deep;
      window.setTimeout(function () { window.location.href = target; }, 250);
    })();
  </script>`
      : ''
  }
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    ${
      input.valid
        ? `<a class="btn" href="${deep}">Open in app</a>
           <a class="btn secondary" href="${intent}">Open on Android</a>
           <p class="hint">If nothing opens, install SplitSaathi, then tap Open in app again.</p>`
        : `<p class="hint">Ask the group admin to send a fresh invite.</p>`
    }
  </main>
</body>
</html>`;
}

/**
 * Deterministic Android versionCode:
 * (MAJOR * 100000) + (MINOR * 1000) + (PATCH * 10)
 */
export function versionCodeFromName(versionName: string): number | null {
  const parts = versionName.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return null;
  }

  const [major, minor, patch] = parts;
  return major * 100000 + minor * 1000 + patch * 10;
}

export function parseVersionCode(versionStr: string, fallback: number): number {
  const fromName = versionCodeFromName(versionStr);
  if (fromName !== null) {
    return fromName;
  }

  const parsed = Number.parseInt(versionStr.replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

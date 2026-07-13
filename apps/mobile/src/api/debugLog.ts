const MAX_LOG_CHARS = 1200;

function isDebugLoggingEnabled() {
  return __DEV__;
}

function truncate(value: string) {
  if (value.length <= MAX_LOG_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_LOG_CHARS)}… [truncated ${value.length - MAX_LOG_CHARS} chars]`;
}

function sanitizePayload(payload: unknown) {
  if (payload === undefined) {
    return undefined;
  }
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    return "[FormData]";
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return String(payload);
  }
}

function formatPayload(payload: unknown) {
  if (payload === undefined) {
    return "";
  }
  return truncate(JSON.stringify(sanitizePayload(payload), null, 0));
}

export function logApiRequest(method: string, path: string, payload?: unknown) {
  if (!isDebugLoggingEnabled()) {
    return;
  }
  const body = formatPayload(payload);
  console.log(`→ ${method} ${path}${body ? ` | payload: ${body}` : ""}`);
}

export function logApiResponse(method: string, path: string, status: number, durationMs: number, payload?: unknown) {
  if (!isDebugLoggingEnabled()) {
    return;
  }
  const body = formatPayload(payload);
  console.log(`← ${status} ${method} ${path} (${durationMs}ms)${body ? ` | response: ${body}` : ""}`);
}

export function logApiError(method: string, path: string, durationMs: number, error: unknown) {
  if (!isDebugLoggingEnabled()) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const details = error instanceof Error && error.stack ? `\n   ${error.stack.split("\n").slice(1, 3).join("\n   ")}` : "";
  console.log(`✗ ${method} ${path} (${durationMs}ms) | ERROR: ${message}${details}`);
}

export function logApiConfig(baseUrl: string) {
  if (!isDebugLoggingEnabled()) {
    return;
  }
  console.log(`[SplitSaathi API] base URL = ${baseUrl}`);
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
    console.log("[SplitSaathi API] WARNING: localhost will not work on a physical phone. Use your LAN IP in EXPO_PUBLIC_API_URL.");
  }
}

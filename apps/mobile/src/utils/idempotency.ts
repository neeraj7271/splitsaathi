export function createClientId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function createIdempotencyKey(scope: string) {
  return createClientId(scope);
}

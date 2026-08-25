const listeners = new Set<() => void>();

export function subscribeUpdateCheck(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestUpdateCheck() {
  for (const listener of listeners) {
    listener();
  }
}

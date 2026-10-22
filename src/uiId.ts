let fallbackSequence = 0;

export function createUiId(prefix = "ui"): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackSequence += 1;
  return `${prefix}-${Date.now()}-${fallbackSequence}`;
}

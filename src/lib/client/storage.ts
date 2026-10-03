type StorageKind = "local" | "session";

// Keep controls usable for this visit even when storage is blocked or full.
const memory = new Map<string, string>();

export function readPreference(kind: StorageKind, key: string) {
  const memoryKey = `${kind}:${key}`;
  if (memory.has(memoryKey)) return memory.get(memoryKey) ?? null;

  try {
    return window[`${kind}Storage`].getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(kind: StorageKind, key: string, value: string) {
  memory.set(`${kind}:${key}`, value);
  try {
    window[`${kind}Storage`].setItem(key, value);
  } catch {
    // Persistence is optional; the in-memory preference still takes effect.
  }
}

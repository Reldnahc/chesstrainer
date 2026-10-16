/** A random identifier for local bookkeeping (history entries, retry identity),
 * not a security token. crypto.randomUUID exists only in secure contexts, so HTTP
 * LAN installs fall back to time and Math.random. */
export function localId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

// HTTP LAN installs may not expose randomUUID. These identify retries, not users.
export const studyRequestId = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

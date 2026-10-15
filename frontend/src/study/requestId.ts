import { localId } from "../localId";

// HTTP LAN installs may not expose randomUUID; localId falls back. These identify retries, not users.
export const studyRequestId = localId;

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export function createCastingMiddleware(options?: { catalogRoot?: string; storageRoot?: string }):
  (request: IncomingMessage, response: ServerResponse, next: () => void) => void;
export function castingChoicesPlugin(): Plugin;

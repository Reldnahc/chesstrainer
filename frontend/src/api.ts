import createClient from "openapi-fetch";
import type { components, paths } from "./api.generated";

let accountMode = false;
let csrf = "";
export function setAccountSession(enabled: boolean, token?: string | null) {
  accountMode = enabled;
  csrf = token || "";
}

/** Where a LAN connection keeps its access token for this tab. */
export const LAN_TOKEN_KEY = "lan-token";
/** The server needs a sign-in (accounts) or an access token (LAN connection). */
export type AuthRequirement = "account" | "connection";
const authEvents: Record<AuthRequirement, string> = { account: "account-required", connection: "connection-required" };

/** Calls `handler` whenever a response says this kind of authentication is needed. */
export function onAuthRequired(kind: AuthRequirement, handler: () => void): () => void {
  window.addEventListener(authEvents[kind], handler);
  return () => window.removeEventListener(authEvents[kind], handler);
}
const authRequired = (kind: AuthRequirement) => window.dispatchEvent(new Event(authEvents[kind]));

/** A failed API response. The message is written for the reader; the status is for callers. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** The fetch never reached the server, or its answer never came back. */
export const UNREACHABLE = "Fieldwork can't be reached. Check the connection and try again.";
const SERVER_PROBLEM = "The server had a problem. Try again in a moment.";

// FastAPI writes `detail` as a string for handled errors, and as a list of
// field problems for request validation.
function detailOf(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("detail" in result)) return null;
  const { detail } = result;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof first.msg === "string") return first.msg;
  }
  return null;
}

/** The text a page shows for any failure: API errors carry their own message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === "string" && error ? error : "Something went wrong. Try again.";
}

export const api = createClient<paths>({ baseUrl: window.location.origin });
api.use({
  onRequest({ request }) {
    if (csrf) request.headers.set("X-CSRF-Token", csrf);
    const token = sessionStorage.getItem(LAN_TOKEN_KEY);
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
  },
  async onResponse({ response, schemaPath }) {
    if (response.ok) return;
    const result: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    const detail = detailOf(result);
    if (response.status === 401 && !schemaPath.startsWith("/api/auth/")) {
      authRequired(accountMode ? "account" : "connection");
    } else if (accountMode && response.status === 403 && detail?.startsWith("Refresh the page")) {
      // The session cookie rotated in another tab; refresh identity to get the current token.
      authRequired("account");
    }
    // A reverse proxy's 502/504 page or an unhandled 500 has no JSON detail.
    const fallback = response.status >= 500 ? SERVER_PROBLEM
      : response.status === 413 ? "That upload is too large for the server."
      : response.status === 400 || response.status === 422 ? "Please check the submitted fields."
      : response.status === 404 ? "That was not found. It may have been removed."
      : "The server couldn’t handle that request.";
    throw new ApiError(detail ?? fallback, response.status);
  },
  onError({ request, error }) {
    // A cancelled request keeps its own error, so callers can tell it apart.
    if (request.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
    return new ApiError(UNREACHABLE, 0);
  },
});

/** Unwrap the endpoint's inferred success type; callers cannot supply a substitute. */
export async function read<T>(request: Promise<{ data?: T }>): Promise<T> {
  const { data } = await request;
  if (data === undefined)
    throw new Error("The server returned an empty response.");
  return data;
}

export function multipart(body: Record<string, unknown>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(body)) {
    if (value !== undefined && value !== null)
      data.append(name, value instanceof Blob ? value : String(value));
  }
  return data;
}

// These are aliases, not independently maintained copies of server payloads.
export type Schema = components["schemas"];
export type LegalMove = Schema["LegalMove"];
export type Promotion = NonNullable<LegalMove["promotion"]>;
export type ColdPosition = Schema["ColdPosition"];
export type Feedback = Schema["ReviewFeedback"];
export type Job = Schema["Job"];
export type Evidence = Schema["Evidence"];
export type MoveExplanation = Schema["MoveExplanation"];
export type PatternFinding = Schema["Finding"];
export type Health = Schema["Health"];
export type PgnImportResult = Schema["PgnImportResult"];
// Roles are a transient UI overlay selected from a finding, not another wire field.
export type ExplanationFrame = Schema["Frame"] & {
  roles?: Record<string, string[]>;
};

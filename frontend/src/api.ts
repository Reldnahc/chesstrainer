import createClient from "openapi-fetch";
import type { components, paths } from "./api.generated";

let accountMode = false;
let csrf = "";
export function setAccountSession(enabled: boolean, token?: string | null) {
  accountMode = enabled;
  csrf = token || "";
}

export const api = createClient<paths>({ baseUrl: window.location.origin });
api.use({
  onRequest({ request }) {
    if (csrf) request.headers.set("X-CSRF-Token", csrf);
    const token = sessionStorage.getItem("lan-token");
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
  },
  async onResponse({ response, schemaPath }) {
    if (response.ok) return;
    if (response.status === 401 && !schemaPath.startsWith("/api/auth/")) {
      window.dispatchEvent(
        new Event(accountMode ? "account-required" : "connection-required"),
      );
    }
    const result: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    throw new Error(
      result &&
      typeof result === "object" &&
      "detail" in result &&
      typeof result.detail === "string"
        ? result.detail
        : "Please check the submitted fields.",
    );
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
export type ChessComImport = Schema["ChessComImportProgress"];
export type Evidence = Schema["Evidence"];
export type MoveExplanation = Schema["MoveExplanation"];
export type PatternFinding = Schema["Finding"];
export type Coverage = Schema["Coverage"];
export type Health = Schema["Health"];
export type PgnImportResult = Schema["PgnImportResult"];
export type WorkspaceSettings = Schema["WorkspaceSettings"];
// Roles are a transient UI overlay selected from a finding, not another wire field.
export type ExplanationFrame = Schema["Frame"] & {
  roles?: Record<string, string[]>;
};

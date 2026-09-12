export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = sessionStorage.getItem('lan-token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('connection-required'));
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Please check the submitted fields.');
  }
  return result;
}
export const post = <T = any>(path: string, data?: object) => api<T>(path, {method: 'POST', body: data ? JSON.stringify(data) : undefined});

export type LegalMove = {from_square: string; to_square: string; promotion: string | null; capture: boolean};
export type ColdPosition = {practice_only?: boolean; last_attempt_id?: string | null;  session_id: string; exercise_id: string; fen: string; orientation: 'white' | 'black'; failed: boolean; review_reason: 'new' | 'resume' | 'learning' | 'relearning' | 'review' | 'practice'; previous_reviews: number; legal_moves: LegalMove[] };
export type ExplanationFrame = {roles?: Record<string, string[]>; fen: string; uci: string | null; san: string; annotation: string; highlights: string[]; material_change: number};
export type Feedback = {practice_only?: boolean; reveal_frame?: ExplanationFrame; attempt_frame?: ExplanationFrame; counter_reply?: ExplanationFrame; attempt_id?: string; explanation_summary?: string; submitted_san?: string;  completed: boolean; next_due?: string | null; retired?: boolean; retired_interval_days?: number | null; grade: string; fen?: string; message?: string; explanation?: string; answers?: {uci: string; san: string; primary: boolean}[]; played_san?: string; source?: string; decision_id?: string };
export type ChessComImport = {username: string; time_class: string; months: number; max_games: number; start_date: string | null; end_date: string | null; archives_total: number; archives_processed: number; games_fetched: number; games_imported: number; duplicates: number; filtered: number; rejected: number; fetch_completed: boolean; errors: {error: string; game?: number; archive?: string}[]};
export type Job = {probe_total?: number | null; id: string; kind: string; status: string; games_processed: number; games_total: number; positions_triaged: number; deep_completed: number; mistakes_identified: number; classifications_completed: number; error?: string; chesscom?: ChessComImport | null; activity?: {games: {active: number; pending: number}; classifications: {active: number; pending: number}} | null};
export type Evidence = {id: string; fen: string; played_san: string; loss_cp: number | null; allows_mate: boolean; mate_lost: boolean; candidates: {san: string; score: {kind: string; value: number}; pv: string[]}[]; classifications: {provider: string; skill: string; confidence: number; explanation: string; run_id: string}[]; facts: any};

export type MoveExplanation = {
  version: string; attempt_id: string | null; authority: 'stockfish' | 'curated'; accepted: boolean;
  move_uci: string; move_san: string; summary: string; notes: string[]; orientation: 'white' | 'black';
  analysis_id: string | null; engine_version: string | null;
  frames: ExplanationFrame[];
  findings: PatternFinding[];
};

export type PatternFinding = {skill_id: string; frame_ply: number; roles: Record<string, string[]>; explanation: string; cue: string; analysis_id: string};
export type Coverage = {total: number; labeled: number; outcomes: number; mechanisms: number; outcome_only: number; unclassified: number; pending: number; abstention_reasons: Record<string, number>};

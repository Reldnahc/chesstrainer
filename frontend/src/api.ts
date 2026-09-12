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
export type ColdPosition = { session_id: string; exercise_id: string; fen: string; orientation: 'white' | 'black'; failed: boolean; legal_moves: LegalMove[] };
export type Feedback = { completed: boolean; grade: string; fen?: string; message?: string; explanation?: string; answers?: {uci: string; san: string; primary: boolean}[]; played_san?: string; source?: string; decision_id?: string };
export type ChessComImport = {username: string; time_class: string; months: number; max_games: number; start_date: string | null; end_date: string | null; archives_total: number; archives_processed: number; games_fetched: number; games_imported: number; duplicates: number; filtered: number; rejected: number; fetch_completed: boolean; errors: {error: string; game?: number; archive?: string}[]};
export type Job = {id: string; kind: string; status: string; games_processed: number; games_total: number; positions_triaged: number; deep_completed: number; mistakes_identified: number; classifications_completed: number; error?: string; chesscom?: ChessComImport | null; activity?: {games: {active: number; pending: number}; classifications: {active: number; pending: number}} | null};
export type Evidence = {id: string; fen: string; played_san: string; loss_cp: number | null; allows_mate: boolean; mate_lost: boolean; candidates: {san: string; score: {kind: string; value: number}; pv: string[]}[]; classifications: {skill: string; confidence: number; explanation: string; run_id: string}[]; facts: any};

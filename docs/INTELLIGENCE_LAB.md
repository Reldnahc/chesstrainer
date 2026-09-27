# Review intelligence laboratory

Run `npm run dev:intelligence` from `frontend`, then visit
`http://127.0.0.1:5175`. This is a separate loopback-only Vite process, like the
animation studio on 5174. It has no API proxy, account session, database connection,
engine or model. The production entry point does not import it; `/intelligence-lab`
is not a product route. It is not packaged into production JavaScript.

In your authenticated application browser, save the JSON response for
`GET /api/games/{id}` (the Network panel shows this request when opening a game).
Open that file in the laboratory, or paste the response. Use the completed game
response to include final refinement, context and narrative. Files are read into
browser memory only, not uploaded or saved to web storage. Keep private exports
in ignored `data/` and out of Git. Inputs over 20 MB or 5,000 frames are rejected.
Unsupported evidence versions ask for a fresh export; invalid input preserves the
last successfully inspected document.

Select a ply to see the exact production neutral intent and deterministic variant,
beside its board. Inspect expandable sections for:

- Stockfish candidates, scores, search IDs, depth, grade, reason and witness lines;
- human model provenance, conditioning, source domain and policy/rank evidence;
- practical difficulty components and calibration caveats;
- semantic tactical/positional events, direct evidence and clock observations;
- game relationships, turning points, relevant cross-game corroboration and narrative;
- selected dialogue claims, rejected/limited evidence decisions and final utterance.

Show Why uses the same board-cue wording as production. Suppressing recorded-game
context demonstrates the branch boundary; it does not create or analyze a branch.
The laboratory uses the same game/path seed as production mainline review. It
never decides legality, quality or human probabilities itself.
The Voice selector draws directly from the selectable coach registry and keeps a
neutral reference. Changing it rerenders the same intent locally; the utterance
trace identifies each custom or neutral fallback template.

`npx playwright test --config playwright.intelligence.config.ts` tests import,
malformed/versioned data, deterministic production parity, mobile layout, no API
requests and exclusion from built assets. The suite is included in CI.

# Review intelligence laboratory

Run `npm run dev:intelligence` from `frontend`, then visit
`http://127.0.0.1:5175`. This is a separate loopback-only Vite process, like the
animation studio on 5174. It has no API proxy, account session, database connection,
engine or model. The production entry point does not import it; `/intelligence-lab`
is not a product route. It is not packaged into production JavaScript.

In your authenticated application browser, save the JSON response for
`GET /api/games/{id}` (the Network panel shows this request when opening a game).
Open that file in the laboratory, or paste the response. Use the completed game
response to include final refinement and context. Files are read into
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
- game relationships, turning points, relevant cross-game corroboration;
- selected dialogue claims, rejected/limited evidence decisions and final utterance.

Show Why uses the same board-cue wording as production. Suppressing recorded-game
context demonstrates the branch boundary; it does not create or analyze a branch.
The laboratory uses the same game/path seed as production mainline review. It
never decides legality, quality or human probabilities itself.
The Voice selector draws directly from the selectable coach registry and keeps a
neutral reference. Changing it rerenders the same intent locally; the utterance
trace identifies each custom or neutral fallback template.
The initial writing section provides synthetic examples for every dialogue purpose,
all current voices, character bibles, deterministic variants and shuffled blind
comparison. A real imported intent can also be compared across the cast. Corpus
errors and writing collisions appear locally in the viewer and fail its tests.

**Compare ten shared situations together** gives every voice the same set of
blunder, tactic, Maia-supported natural mistake, difficult best move, recovery,
missed opportunity, quiet development, forced defense, checkmate and retry inputs.
Blind mode keeps its shuffled voice numbering stable across scenarios and samples;
names, portraits and strategy labels remain hidden until the notes are opened.
This allows several responses to be judged as one voice instead of treating one
unusual synonym as a personality. These exercises are synthetic, clearly labeled
writing inputs, not claims about measured player behavior.

The coverage audit shows samples, character claims, neutral fallback claims and
composed forms for each registered coach. Common primary claims must have custom
handling; exact actor/line-scope safety still deliberately uses neutral or protected
conditional rendering when required. Identical short factual sentences are allowed.
An entire identical cross-scenario corpus is reported as a collision. Behavior
tests verify strategy execution, deterministic question selection, mandatory-slot
protection, cold feedback, and unchanged semantic delivery and provenance.

`npx playwright test --config playwright.intelligence.config.ts` tests import,
malformed/versioned data, deterministic production parity, mobile layout, no API
requests and exclusion from built assets. The suite is included in CI.

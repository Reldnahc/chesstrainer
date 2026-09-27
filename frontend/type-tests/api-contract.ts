import { api, read, type ColdPosition, type Schema } from "../src/api";

// Compile-only regressions: these must fail if endpoint types become `any` or
// callers can again substitute an unrelated hand-written response shape.
async function endpointContracts() {
  const health = await read(api.GET("/api/health"));
  const available: boolean = health.engine_available;
  // @ts-expect-error health does not contain a game board
  health.frames;
  // @ts-expect-error endpoint return types cannot be substituted by the caller
  api.GET<ColdPosition>("/api/health");
  // @ts-expect-error unwrapping cannot change an endpoint's response contract
  read<ColdPosition>(api.GET("/api/health"));
  // @ts-expect-error route does not exist
  api.GET("/api/unknown");
  // @ts-expect-error game_id is required
  api.GET("/api/games/{game_id}");
  // @ts-expect-error missing credential field
  api.POST("/api/auth/login", { body: { username: "learner" } });
  // @ts-expect-error query values follow the backend request contract
  api.GET("/api/games", { params: { query: { offset: "first" } } });
  // @ts-expect-error multipart uploads require binary data
  api.POST("/api/imports", { body: { file: "not a file" } });

  const game = await read(
    api.GET("/api/games/{game_id}", {
      params: { path: { game_id: "fixture" } },
    }),
  );
  const move = await read(
    api.POST("/api/review/sessions/{session_id}/move", {
      params: { path: { session_id: "fixture" } },
      body: { from_square: "a7", to_square: "a8", promotion: "q" },
    }),
  );
  const feedback: Schema["ReviewFeedback"] = move;
  // @ts-expect-error score values are numeric
  const invalidScore: Schema["Score"] = { kind: "cp", value: "100" };
  // @ts-expect-error required response fields must not silently disappear
  const incomplete: Schema["Health"] = { database: "ready" };
  return { available, game, feedback, invalidScore, incomplete };
}
void endpointContracts;

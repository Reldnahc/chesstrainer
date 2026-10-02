import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { build } from "vite";
import { loadStyleBoundaries, productionDevelopmentBoundaryPlugin, styleBoundaryPlugin } from "./style-boundaries.mjs";

const manifest = loadStyleBoundaries();
const appStyle = manifest.applicationOnly[0];
const boardStyle = manifest.applicationAndIntelligence[0];

async function fixture(t, imported, nested = false) {
  const root = await mkdtemp(join(tmpdir(), "fieldwork-style-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries({
    "index.html": '<script type="module" src="/main.js"></script>',
    "main.js": `import './${nested ? "entry.css" : imported}';`,
    "entry.css": `@import './${imported}';`,
    [appStyle]: "body { color: red; }",
    [boardStyle]: "body { color: blue; }",
    "src/shared.css": "body { color: green; }",
  })) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return {
    async check(surface) {
      return build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [styleBoundaryPlugin(surface, root, manifest)],
        build: { write: false, emptyOutDir: false },
      });
    },
    root,
  };
}

for (const surface of ["coach-studio", "intelligence-lab", "audio-studio"]) {
  for (const nested of [false, true]) {
    test(`${surface} rejects application CSS via ${nested ? "CSS @import" : "JS import"}`, async (t) => {
      const source = await fixture(t, appStyle, nested);
      await assert.rejects(source.check(surface), {
        message: new RegExp(`${surface} imports application styles: ${appStyle}`),
      });
      assert.equal(existsSync(join(source.root, "dist")), false);
    });
  }
  test(`${surface} accepts shared CSS without writing build output`, async (t) => {
    const source = await fixture(t, "src/shared.css", true);
    await source.check(surface);
    assert.equal(existsSync(join(source.root, "dist")), false);
  });
}

for (const nested of [false, true]) {
  test(`board styles stay in the intelligence lab via ${nested ? "CSS @import" : "JS import"}`, async (t) => {
    const source = await fixture(t, boardStyle, nested);
    await source.check("intelligence-lab");
    for (const surface of ["coach-studio", "audio-studio"]) {
      await assert.rejects(source.check(surface), {
        message: new RegExp(`${surface} imports application styles: ${boardStyle}`),
      });
    }
  });
}

async function applicationFixture(t, imported, dynamic = false) {
  const root = await mkdtemp(join(tmpdir(), "fieldwork-production-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const contents = imported.endsWith(".json") ? '{"recordings":[]}'
    : imported.endsWith(".opus") ? "mock audio" : "export default 'voice';";
  for (const [path, content] of Object.entries({
    "index.html": '<script type="module" src="/main.js"></script>',
    "main.js": dynamic ? `import('./${imported}').then(value => {globalThis.voice = value.default;});`
      : `import voice from './${imported}'; globalThis.voice = voice;`,
    [imported]: contents,
  })) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return {
    root,
    check: () => build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [productionDevelopmentBoundaryPlugin(root)],
      build: { write: false, emptyOutDir: false },
    }),
  };
}

for (const imported of [
  "src/audio/speech/castAuditions.ts",
  "src/audio/speech/cast-auditions/manifest.json",
  "src/audio/speech/cast-auditions/tracks.json",
  "src/audio/speech/cast-auditions/recordings/cat-1.opus",
  "src/audio/studio/shared-player.js",
  "src/coach/studio/inspector.js",
]) for (const dynamic of [false, true]) {
  test(`application rejects ${dynamic ? "dynamic" : "static"} development import ${imported}`, async (t) => {
    const source = await applicationFixture(t, imported, dynamic);
    await assert.rejects(source.check(), /Application imports development-only voice assets or studio modules/);
    assert.equal(existsSync(join(source.root, "dist")), false);
  });
}

test("application retains production speech and similarly named non-studio modules", async (t) => {
  for (const imported of [
    "src/audio/speech/bank/tracks.json",
    "src/audio/speech/bank/recordings/walter/line.opus",
    "src/audio/studio-settings.js",
  ]) {
    const source = await applicationFixture(t, imported);
    await source.check();
    assert.equal(existsSync(join(source.root, "dist")), false);
  }
});

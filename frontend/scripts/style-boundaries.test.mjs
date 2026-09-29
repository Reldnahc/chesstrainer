import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { build } from "vite";
import { loadStyleBoundaries, styleBoundaryPlugin } from "./style-boundaries.mjs";

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

for (const surface of ["coach-studio", "intelligence-lab"]) {
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

test("board styles stay available to the intelligence lab but are excluded from the coach studio", async (t) => {
  const source = await fixture(t, boardStyle, true);
  await source.check("intelligence-lab");
  await assert.rejects(source.check("coach-studio"), {
    message: new RegExp(`coach-studio imports application styles: ${boardStyle}`),
  });
});

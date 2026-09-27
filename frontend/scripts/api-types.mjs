import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";

const input = new URL(
  "../../backend/tests/fixtures/api_contract.json",
  import.meta.url,
);
const output = new URL("../src/api.generated.ts", import.meta.url);
const ast = await openapiTS(input, {
  transform(schema) {
    // Multipart uploads carry binary data, not an arbitrary string or `any`.
    if (
      schema.format === "binary" ||
      schema.contentMediaType === "application/octet-stream"
    ) {
      return ts.factory.createTypeReferenceNode("Blob");
    }
  },
});
const content =
  "// Generated from the backend OpenAPI contract. Run npm run api:generate.\n" +
  astToString(ast);
if (process.argv.includes("--check")) {
  const saved = await readFile(output, "utf8").catch(() => "");
  if (saved.replaceAll("\r\n", "\n") !== content.replaceAll("\r\n", "\n")) {
    throw new Error("Generated API types are stale. Run npm run api:generate.");
  }
  console.log("Generated API types match OpenAPI.");
} else {
  await writeFile(output, content);
  console.log("Generated src/api.generated.ts");
}

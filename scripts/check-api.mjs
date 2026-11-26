// Fails when the public API changes without anyone saying so.
//
// The public API is what the build exposes: the type declarations in
// dist/BM25.d.ts and the names exported at run time. Both are compared with
// the committed snapshot in tests/api/public-api.snapshot.
//
// A difference is not always a mistake. When the change is intended, run
//   npm run test:api -- --update
// and commit the snapshot. The diff of that file in the pull request then
// shows reviewers exactly how the API changed, which is what decides whether
// the next version is a patch, a minor or a major.
//
// Run with `npm run test:api`, which builds first.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotFile = join(root, "tests", "api", "public-api.snapshot");
const { main, types } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// Documentation comments are left out, so rewording one is not an API change.
const declarations = readFileSync(join(root, types), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/^[ \t]*\/\*\*[\s\S]*?\*\/\n?/gm, "")
  .trim();
const runtimeExports = Object.keys(createRequire(import.meta.url)(join(root, main))).sort();
const current = [
  `// Types: ${types}`,
  declarations,
  "",
  `// Names exported at run time by ${main}`,
  ...runtimeExports.map((name) => `//   ${name}`),
  "",
].join("\n");

if (process.argv.includes("--update")) {
  mkdirSync(dirname(snapshotFile), { recursive: true });
  writeFileSync(snapshotFile, current);
  console.log("Wrote tests/api/public-api.snapshot. Commit it with the change.");
  process.exit(0);
}

const snapshot = existsSync(snapshotFile) ? readFileSync(snapshotFile, "utf8").replace(/\r\n/g, "\n") : "";
if (snapshot === current) {
  console.log(`API check passed: types and ${runtimeExports.length} run-time exports match the snapshot.`);
  process.exit(0);
}

// A plain listing of the lines that left and the lines that arrived is enough
// for a file this small.
const before = snapshot.split("\n");
const after = current.split("\n");
console.error("The public API differs from tests/api/public-api.snapshot.\n");
for (const line of before) if (!after.includes(line)) console.error(`  - ${line}`);
for (const line of after) if (!before.includes(line)) console.error(`  + ${line}`);
console.error(
  "\nIf this change is intended, run `npm run test:api -- --update` and commit the snapshot.\n" +
    "Removing or narrowing something that users can call is a breaking change.",
);
process.exit(1);

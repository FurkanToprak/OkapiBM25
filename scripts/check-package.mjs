// Checks the package the way a user receives it.
//
// Packs the tarball, installs it into an empty project and then:
//   1. compares the list of published files with the expected list,
//   2. loads it with require() and with import, by package name,
//   3. compiles a strict TypeScript consumer against the published types.
//
// Run with `npm run test:package`, which builds first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const onWindows = process.platform === "win32";
const npm = onWindows ? "npm.cmd" : "npm";
const tsc = join(root, "node_modules", ".bin", onWindows ? "tsc.cmd" : "tsc");

const run = (command, args, cwd) => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      shell: onWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    console.error(`Failed: ${command} ${args.join(" ")}`);
    console.error(String(error.stdout || ""));
    console.error(String(error.stderr || ""));
    throw error;
  }
};

const expectedFiles = [
  "LICENSE.md",
  "README.md",
  "dist/BM25.d.ts",
  "dist/BM25.js",
  "dist/BM25.js.map",
  "package.json",
];

const commonJsConsumer = `
const assert = require("node:assert/strict");
const pkg = require("okapibm25");

assert.equal(typeof pkg.default, "function", "require('okapibm25').default is the function");
assert.equal(pkg.BM25, pkg.default, "require('okapibm25').BM25 is the same function");
for (const helper of ["getIDF", "getTermFrequency", "getWordCount"]) {
  assert.equal(typeof pkg[helper], "function", helper + " is exported");
}
const { BM25 } = pkg;
const scores = BM25(["a cat", "a dog"], ["cat"]);
assert.ok(scores[0] > 0 && scores[1] === 0);
const ranked = pkg.default(["a cat", "a dog"], ["dog"], undefined, (x, y) => y.score - x.score);
assert.equal(ranked[0].document, "a dog");
`;

const esModuleConsumer = `
import assert from "node:assert/strict";
import pkg, { BM25, getIDF, getTermFrequency, getWordCount } from "okapibm25";

assert.equal(typeof BM25, "function", "import { BM25 } from 'okapibm25' is the function");
assert.equal(pkg.BM25, BM25);
assert.equal(pkg.default, BM25, "the 1.4.1 form, (default import).default, still works");
assert.equal(typeof getIDF, "function");
assert.equal(typeof getTermFrequency, "function");
assert.equal(typeof getWordCount, "function");
const scores = BM25(["a cat", "a dog"], ["cat"]);
assert.ok(scores[0] > 0 && scores[1] === 0);
`;

const typeScriptConsumer = `
import BM25, {
  BM25 as NamedBM25,
  BMConstants,
  BMDocument,
  BMSorter,
  getIDF,
  getTermFrequency,
  getWordCount,
} from "okapibm25";

const constants: BMConstants = { k1: 1.2, b: 0.75 };
const sorter: BMSorter = (first, second) => second.score - first.score;
export const scores: number[] = BM25(["a cat", "a dog"], ["cat"], constants);
export const ranked: BMDocument[] = NamedBM25(["a cat", "a dog"], ["cat"], undefined, sorter);
export const castScores = BM25(["a cat"], ["cat"]) as number[];
export const castRanked = BM25(["a cat"], ["cat"], undefined, sorter) as BMDocument[];
export const numbers: number[] = [getIDF("a", ["a"]), getTermFrequency("a", "a"), getWordCount("a")];
`;

const typeScriptEsModuleConsumer = `
import { BM25, type BMDocument } from "okapibm25";

export const scores: number[] = BM25(["a cat", "a dog"], ["cat"]);
export const ranked: BMDocument[] = BM25(["a cat"], ["cat"], undefined, (first, second) => second.score - first.score);
`;

const workDirectory = mkdtempSync(join(tmpdir(), "okapibm25-package-"));
try {
  // 1. What gets published.
  const [packed] = JSON.parse(
    run(npm, ["pack", "--json", "--pack-destination", workDirectory], root)
  );
  const publishedFiles = packed.files.map((file) => file.path).sort();
  assert.deepEqual(
    publishedFiles,
    expectedFiles,
    "The published file list changed. Update expectedFiles in scripts/check-package.mjs if that is intended."
  );

  // 2. Install into an empty project and load by package name.
  const consumer = join(workDirectory, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true }));
  run(
    npm,
    ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--no-package-lock", join(workDirectory, packed.filename)],
    consumer
  );
  writeFileSync(join(consumer, "consumer.cjs"), commonJsConsumer);
  writeFileSync(join(consumer, "consumer.mjs"), esModuleConsumer);
  run(process.execPath, ["consumer.cjs"], consumer);
  run(process.execPath, ["consumer.mjs"], consumer);

  // 3. Compile strict TypeScript consumers against the published types.
  writeFileSync(join(consumer, "typed.ts"), typeScriptConsumer);
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, module: "commonjs", esModuleInterop: true, noEmit: true, types: [], skipLibCheck: false },
      files: ["typed.ts"],
    })
  );
  run(tsc, ["-p", "tsconfig.json"], consumer);
  writeFileSync(join(consumer, "typed-esm.mts"), typeScriptEsModuleConsumer);
  writeFileSync(
    join(consumer, "tsconfig.esm.json"),
    JSON.stringify({
      compilerOptions: { strict: true, module: "nodenext", noEmit: true, types: [], skipLibCheck: false },
      files: ["typed-esm.mts"],
    })
  );
  run(tsc, ["-p", "tsconfig.esm.json"], consumer);

  console.log(
    `Package check passed: ${publishedFiles.length} files, ${packed.unpackedSize} bytes unpacked. ` +
      "require, import and TypeScript consumers all work."
  );
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}

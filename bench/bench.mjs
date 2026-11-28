// Benchmark: the current build against the frozen okapibm25@1.4.1 build.
//
//   npm run bench                        print a table
//   npm run bench -- --min-speedup 1.5   also fail if any scenario is less than 1.5x faster than 1.4.1
//   npm run bench -- --json              print machine-readable results
//
// Both builds run in the same process on the same data, so the speedup figure
// is comparable between machines even though the absolute times are not.
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const current = require("../dist/BM25.js").default;
const { createIndex } = require("../dist/BM25.js");
const legacy = require("../tests/regression/legacy-v1.4.1.js").default;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const minSpeedupIndex = args.indexOf("--min-speedup");
const minSpeedup = minSpeedupIndex === -1 ? 0 : Number(args[minSpeedupIndex + 1]);
if (Number.isNaN(minSpeedup)) {
  console.error("--min-speedup needs a number, for example --min-speedup 1.5");
  process.exit(2);
}

/** Small seeded generator, so every run scores the same text. */
const random = (() => {
  let state = 0x2f6e2b1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const letters = "abcdefghijklmnopqrstuvwxyz";
const vocabulary = Array.from({ length: 5000 }, () => {
  const length = 3 + Math.floor(random() * 8);
  let word = "";
  for (let i = 0; i < length; i++) {
    word += letters[Math.floor(random() * letters.length)];
  }
  return word;
});
/** Skewed towards the start of the vocabulary, like real text. */
const pickWord = () => vocabulary[Math.floor(vocabulary.length * random() ** 3)];
const makeDocument = (words) => {
  const parts = [];
  for (let i = 0; i < words; i++) {
    parts.push(pickWord());
  }
  // The round trip through a Buffer gives a flat string, like text read from a
  // file or parsed from JSON. Joined strings are stored differently and are
  // slower to scan for both builds.
  return Buffer.from(parts.join(" ") + ".", "latin1").toString("latin1");
};
const makeCorpus = (documents, words) =>
  Array.from({ length: documents }, () =>
    makeDocument(Math.max(1, Math.round(words * (0.5 + random()))))
  );
const makeQuery = (keywords) => Array.from({ length: keywords }, pickWord);
const descending = (first, second) => second.score - first.score;

const scenarios = [
  { name: "100 docs x 50 words, 3 keywords", documents: makeCorpus(100, 50), keywords: makeQuery(3) },
  { name: "1,000 docs x 200 words, 5 keywords", documents: makeCorpus(1000, 200), keywords: makeQuery(5) },
  { name: "1,000 docs x 200 words, 25 keywords", documents: makeCorpus(1000, 200), keywords: makeQuery(25) },
  { name: "10,000 docs x 200 words, 5 keywords", documents: makeCorpus(10000, 200), keywords: makeQuery(5) },
  { name: "1,000 docs x 200 words, 5 keywords, sorted", documents: makeCorpus(1000, 200), keywords: makeQuery(5), sorter: descending },
  { name: "20 docs x 2,000 words, 5 keywords", documents: makeCorpus(20, 2000), keywords: makeQuery(5) },
];

/** Median time of one call in milliseconds. */
const measure = (implementation, scenario) => {
  const run = () =>
    implementation(scenario.documents, scenario.keywords, undefined, scenario.sorter);
  const warmUpUntil = performance.now() + 200;
  while (performance.now() < warmUpUntil) {
    run();
  }
  const samples = [];
  const stopAt = performance.now() + 600;
  while (performance.now() < stopAt || samples.length < 5) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  samples.sort((first, second) => first - second);
  return samples[Math.floor(samples.length / 2)];
};

const results = scenarios.map((scenario) => {
  const expected = JSON.stringify(
    legacy(scenario.documents, scenario.keywords, undefined, scenario.sorter)
  );
  const actual = JSON.stringify(
    current(scenario.documents, scenario.keywords, undefined, scenario.sorter)
  );
  if (expected !== actual) {
    console.error(`Results differ from 1.4.1 for: ${scenario.name}`);
    process.exit(1);
  }
  const legacyMs = measure(legacy, scenario);
  const currentMs = measure(current, scenario);
  return { scenario: scenario.name, legacyMs, currentMs, speedup: legacyMs / currentMs };
});

// The index, for searching the same documents again and again. It matches
// whole words where BM25 matches text, so its scores are not compared with
// BM25 here; tests/index.test.ts does that on text where the two agree.
const indexResults = [scenarios[1], scenarios[3]].map((scenario) => {
  const index = createIndex(scenario.documents);
  const call = { documents: scenario.documents, keywords: scenario.keywords };
  return {
    scenario: scenario.name,
    bm25Ms: measure(current, call),
    buildMs: measure((documents) => createIndex(documents), call),
    searchMs: measure((documents, keywords) => index.search(keywords, { limit: 10 }), call),
  };
});

if (asJson) {
  console.log(JSON.stringify({ node: process.version, results, index: indexResults }, null, 2));
} else {
  const format = (milliseconds) => milliseconds.toFixed(3).padStart(10);
  const width = Math.max(...results.map((result) => result.scenario.length));
  console.log(`Node ${process.version}. Median time per call in milliseconds.\n`);
  console.log(`${"scenario".padEnd(width)}  ${"1.4.1".padStart(10)}  ${"current".padStart(10)}  speedup`);
  for (const result of results) {
    console.log(
      `${result.scenario.padEnd(width)}  ${format(result.legacyMs)}  ${format(result.currentMs)}  ${result.speedup.toFixed(1)}x`
    );
  }
  console.log(`\ncreateIndex: built once, then searched (best 10 results).\n`);
  console.log(`${"scenario".padEnd(width)}  ${"BM25 call".padStart(10)}  ${"build".padStart(10)}  ${"search".padStart(10)}`);
  for (const result of indexResults) {
    console.log(
      `${result.scenario.padEnd(width)}  ${format(result.bm25Ms)}  ${format(result.buildMs)}  ${format(result.searchMs)}`
    );
  }
}

const slowest = results.reduce((worst, result) => (result.speedup < worst.speedup ? result : worst));
if (slowest.speedup < minSpeedup) {
  console.error(
    `\nToo slow: "${slowest.scenario}" is ${slowest.speedup.toFixed(2)}x the speed of 1.4.1, below the required ${minSpeedup}x.`
  );
  process.exit(1);
}

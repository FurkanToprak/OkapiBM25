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

// The table above times the older call, BM25(documents, keywords), because
// that is the one 1.4.1 has. This part times BM25(documents): making it, which
// builds the index, and a search with and without the index. It matches whole
// words where the older call matches text, so the scores are not compared
// here; tests/search.test.ts does that on text where the two agree.
const searcherResults = [scenarios[1], scenarios[3]].map((scenario) => {
  const withIndex = current(scenario.documents);
  const withoutIndex = current(scenario.documents, { index: false });
  const call = { documents: scenario.documents, keywords: scenario.keywords };
  const options = { limit: 10 };
  if (JSON.stringify(withIndex.search(call.keywords, options)) !== JSON.stringify(withoutIndex.search(call.keywords, options))) {
    console.error(`Results with and without an index differ for: ${scenario.name}`);
    process.exit(1);
  }
  return {
    scenario: scenario.name,
    buildMs: measure((documents) => current(documents), call),
    searchMs: measure((documents, keywords) => withIndex.search(keywords, options), call),
    searchWithoutIndexMs: measure((documents, keywords) => withoutIndex.search(keywords, options), call),
    olderCallMs: measure(current, call),
  };
});

if (asJson) {
  console.log(JSON.stringify({ node: process.version, results, searcher: searcherResults }, null, 2));
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
  console.log(`\nBM25(documents): made once, then searched for the best 10 results.\n`);
  console.log(
    `${"scenario".padEnd(width)}  ${"make".padStart(10)}  ${"search".padStart(10)}  ${"no index".padStart(10)}  ${"older call".padStart(10)}`
  );
  for (const result of searcherResults) {
    console.log(
      `${result.scenario.padEnd(width)}  ${format(result.buildMs)}  ${format(result.searchMs)}  ${format(result.searchWithoutIndexMs)}  ${format(result.olderCallMs)}`
    );
  }
  console.log(
    `\nmake: BM25(documents), which builds the index. search: one search of that index.\n` +
      `no index: one search of BM25(documents, { index: false }). older call: BM25(documents, keywords).`
  );
}

const slowest = results.reduce((worst, result) => (result.speedup < worst.speedup ? result : worst));
if (slowest.speedup < minSpeedup) {
  console.error(
    `\nToo slow: "${slowest.scenario}" is ${slowest.speedup.toFixed(2)}x the speed of 1.4.1, below the required ${minSpeedup}x.`
  );
  process.exit(1);
}

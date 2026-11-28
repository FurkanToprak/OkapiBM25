// The application that each bundler bundles. It prints one line of JSON.
// run.mjs also runs this file unbundled in Node and requires every bundle to
// print the same `result`.
import defaultImport, { BM25, createIndex, getIDF, getTermFrequency, getWordCount } from "okapibm25";
import * as namespace from "okapibm25";

const documents = [
  "The quick brown fox jumps over the lazy dog",
  "A quick brown dog outpaces a quick fox",
  "Lazy dogs sleep all day, c++ programmers do not",
  "",
];
const keywords = ["quick", "dog", "c++"];
const sorter = (first, second) => second.score - first.score;
const searcher = BM25(documents);
const withoutIndex = BM25(documents, { index: false });
const index = createIndex(documents);

const result = {
  search: searcher.search(["Quick", "dog?"], { limit: 2 }),
  searcherScores: searcher.scores(keywords, { k1: 1.5, b: 0.5 }),
  searchWithoutIndex: withoutIndex.search(["Quick", "dog?"], { limit: 2 }),
  scoresWithoutIndex: withoutIndex.scores(keywords, { k1: 1.5, b: 0.5 }),
  indexSearch: index.search(["Quick", "dog?"], { limit: 2 }),
  indexScores: index.scores(keywords, { k1: 1.5, b: 0.5 }),
  scores: BM25(documents, keywords),
  tuned: BM25(documents, keywords, { k1: 1.5, b: 0.5 }),
  ranked: BM25(documents, keywords, undefined, sorter),
  idf: getIDF("quick", documents),
  termFrequency: getTermFrequency("quick", documents[1]),
  wordCount: getWordCount(documents[0]),
};

// How the default export arrives differs between Node and bundlers: a default
// import of a CommonJS package is the function in a bundler and the whole
// exports object in Node. run.mjs checks that one of the forms 1.4.1 users
// rely on leads to the function.
const shape = (value) =>
  typeof value === "function"
    ? "function"
    : value != null && typeof value.default === "function"
      ? "object with .default"
      : typeof value;
const interop = {
  defaultImport: shape(defaultImport),
  namespaceDefault: shape(namespace.default),
};

console.log(JSON.stringify({ result, interop }));

/**
 * Fixed inputs for the golden regression test. Changing anything here
 * invalidates tests/regression/golden-v1.4.1.json.
 */
export const documents: string[] = [
  "The okapi is an artiodactyl mammal that is endemic to the northeast Democratic Republic of the Congo.",
  "Okapi BM25 is a ranking function used by search engines to estimate the relevance of documents to a given search query.",
  "BM25 is a bag-of-words retrieval function that ranks a set of documents based on the query terms appearing in each document.",
  "The quick brown fox jumps over the lazy dog. The dog barks; the fox runs away.",
  "search search search search search",
  "A",
  "Relevance, ranking and retrieval: three words that every search engine cares about. Ranking is hard, relevance is harder.",
  "pass_the_potatoes PASS the Potatoes, pass.the.potatoes\npass\tthe\tpotatoes",
  "In information retrieval, tf-idf, short for term frequency-inverse document frequency, reflects how important a word is to a document in a collection.",
  "The giraffe is a tall African hoofed mammal. The okapi is its only living relative, and the two share a family.",
  "2024 was the year 2024 2024; version 1.4.1 shipped on 09/09/2024.",
  "document",
];

export const queries: string[][] = [
  ["okapi"],
  ["search", "engine"],
  ["ranking", "relevance", "retrieval"],
  ["the"],
  ["The", "the"],
  ["mammal", "okapi", "giraffe"],
  ["2024"],
  ["document", "documents"],
  ["missing"],
  ["a"],
  ["search", "search"],
  ["pass", "potatoes"],
  ["term frequency"],
  ["fox", "dog", "missing", "okapi", "BM25", "query", "word"],
];

export const constants: Array<{ b?: number; k1?: number } | undefined> = [
  undefined,
  {},
  { k1: 1.2, b: 0.75 },
  { k1: 2, b: 1 },
  { k1: 1.5 },
  { b: 0.3 },
  { k1: 0.5, b: 0.1 },
  { k1: 3, b: 0.9 },
];

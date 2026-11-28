// A strict TypeScript consumer that compiles to CommonJS.
// Uses only syntax that TypeScript 4.0 understands.
import BM25, {
  BM25 as NamedBM25,
  BMConstants,
  BMDocument,
  BMHit,
  BMIndex,
  BMIndexOptions,
  BMOptions,
  BMSearcher,
  BMSearchOptions,
  BMSorter,
  createIndex,
  getIDF,
  getTermFrequency,
  getWordCount,
} from "okapibm25";

const constants: BMConstants = { k1: 1.2, b: 0.75 };
const sorter: BMSorter = (first, second) => second.score - first.score;
const documents: readonly string[] = ["a cat", "a dog"];

export const scores: number[] = BM25(documents, ["cat"], constants);
export const ranked: BMDocument[] = NamedBM25(documents, ["cat"], undefined, sorter);
// The casts that 1.4.1 required still compile.
export const castScores = BM25(["a cat"], ["cat"]) as number[];
export const castRanked = BM25(["a cat"], ["cat"], undefined, sorter) as BMDocument[];
export const numbers: number[] = [getIDF("a", ["a"]), getTermFrequency("a", "a"), getWordCount("a")];

// BM25 with documents only returns a searcher. The overload has to be chosen
// correctly by every TypeScript version: options give a searcher, an array
// of keywords gives scores.
const options: BMOptions = { index: false, caseSensitive: false, tokenizer: (text) => text.split(" ") };
const searchOptions: BMSearchOptions = { k1: 1.2, b: 0.75, limit: 5 };
export const searcher: BMSearcher = BM25(documents);
export const withoutIndex: BMSearcher = NamedBM25(documents, options);
export const inline: BMSearcher = BM25(documents, { index: false });
export const hits: BMHit[] = searcher.search(["cat"], searchOptions);
export const searcherScores: number[] = withoutIndex.scores(["cat"], constants);
export const hitsAsDocuments: BMDocument[] = BM25(documents).search(["cat"]);
export const fromEmptyKeywords: number[] = BM25(documents, []);
const mutableKeywords: string[] = ["cat"];
export const fromMutableKeywords: number[] = BM25(documents, mutableKeywords);
// Keywords typed `any` select the older call, as they did before 2.2.
export const fromAnyKeywords: number[] = BM25(documents, JSON.parse('["cat"]'));

// The names from 2.1.0 still compile.
const indexOptions: BMIndexOptions = { caseSensitive: false, tokenizer: (text) => text.split(" ") };
export const index: BMIndex = createIndex(documents, indexOptions);
export const indexHits: BMHit[] = index.search(["cat"], searchOptions);
export const indexScores: number[] = index.scores(["cat"], constants);

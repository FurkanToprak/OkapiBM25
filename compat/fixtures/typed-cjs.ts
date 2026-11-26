// A strict TypeScript consumer that compiles to CommonJS.
// Uses only syntax that TypeScript 4.0 understands.
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
const documents: readonly string[] = ["a cat", "a dog"];

export const scores: number[] = BM25(documents, ["cat"], constants);
export const ranked: BMDocument[] = NamedBM25(documents, ["cat"], undefined, sorter);
// The casts that 1.4.1 required still compile.
export const castScores = BM25(["a cat"], ["cat"]) as number[];
export const castRanked = BM25(["a cat"], ["cat"], undefined, sorter) as BMDocument[];
export const numbers: number[] = [getIDF("a", ["a"]), getTermFrequency("a", "a"), getWordCount("a")];

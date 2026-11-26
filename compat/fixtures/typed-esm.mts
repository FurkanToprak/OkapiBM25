// A strict TypeScript consumer that is an ES module, checked with
// `module: nodenext` (TypeScript 4.7 and later).
import { BM25, type BMDocument } from "okapibm25";

export const scores: number[] = BM25(["a cat", "a dog"], ["cat"]);
export const ranked: BMDocument[] = BM25(["a cat"], ["cat"], undefined, (first, second) => second.score - first.score);

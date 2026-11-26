// A strict TypeScript consumer in a bundled application, checked with
// `moduleResolution: bundler` (TypeScript 5.0 and later).
import BM25Default, { BM25, type BMDocument } from "okapibm25";

export const scores: number[] = BM25(["a cat", "a dog"], ["cat"]);
export const ranked: BMDocument[] = BM25Default(["a cat"], ["cat"], undefined, (first, second) => second.score - first.score);

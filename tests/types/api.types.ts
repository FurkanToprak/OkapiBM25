/**
 * Compile-time tests for the public types. This file is never run. It is
 * checked by `npm run typecheck`, which fails if an inferred type changes or
 * if a line marked `@ts-expect-error` starts to compile.
 */
import DefaultBM25, {
  BM25,
  BMConstants,
  BMDocument,
  BMHit,
  BMIndex,
  BMIndexOptions,
  BMSearchOptions,
  BMSorter,
  createIndex,
  getIDF,
  getTermFrequency,
  getWordCount,
} from "../../BM25";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
/** Fails to compile unless its type argument is exactly `true`. */
export function assertType<Check extends true>(): Check | undefined {
  return undefined;
}

const documents = ["a cat", "a dog"];
const keywords = ["cat"];
const descending: BMSorter = (first, second) => second.score - first.score;

// The default export and the named export are the same function.
assertType<Equal<typeof DefaultBM25, typeof BM25>>();

// Without a sorter the result is a list of scores. No cast is needed.
const scores = BM25(documents, keywords);
assertType<Equal<typeof scores, number[]>>();
const scoresWithConstants = BM25(documents, keywords, { k1: 1.5, b: 0.5 });
assertType<Equal<typeof scoresWithConstants, number[]>>();
const scoresWithUndefined = BM25(documents, keywords, undefined);
assertType<Equal<typeof scoresWithUndefined, number[]>>();

// With a sorter the result is a list of scored documents.
const ranked = BM25(documents, keywords, undefined, descending);
assertType<Equal<typeof ranked, BMDocument[]>>();
const rankedInline = BM25(documents, keywords, { b: 0 }, (first, second) => {
  assertType<Equal<typeof first, BMDocument>>();
  assertType<Equal<typeof second, BMDocument>>();
  return first.document.localeCompare(second.document);
});
assertType<Equal<typeof rankedInline, BMDocument[]>>();

// A sorter that may be missing gives the union, as in 1.4.1.
declare const maybeSorter: BMSorter | undefined;
const either = BM25(documents, keywords, undefined, maybeSorter);
assertType<Equal<typeof either, number[] | BMDocument[]>>();

// Code written against 1.4.1 casts the result. Those casts still compile.
export const castScores = BM25(documents, keywords, { k1: 1.3, b: 0.9 }) as number[];
export const castRanked = BM25(documents, keywords, undefined, descending) as BMDocument[];

// Read-only inputs are accepted.
declare const readonlyDocuments: readonly string[];
declare const readonlyKeywords: ReadonlyArray<string>;
declare const readonlyConstants: Readonly<BMConstants>;
const fromReadonly = BM25(readonlyDocuments, readonlyKeywords, readonlyConstants);
assertType<Equal<typeof fromReadonly, number[]>>();
const tuple = BM25(["a", "b"] as const, ["a"] as const);
assertType<Equal<typeof tuple, number[]>>();

// Shapes of the exported types.
assertType<Equal<BMDocument, { document: string; score: number }>>();
assertType<Equal<BMConstants, { b?: number; k1?: number }>>();
assertType<Equal<BMSorter, (firstEl: BMDocument, secondEl: BMDocument) => number>>();
assertType<Equal<ReturnType<typeof getWordCount>, number>>();
assertType<Equal<Parameters<typeof getWordCount>, [corpus: string]>>();
assertType<Equal<ReturnType<typeof getTermFrequency>, number>>();
assertType<Equal<Parameters<typeof getTermFrequency>, [term: string, corpus: string]>>();
assertType<Equal<ReturnType<typeof getIDF>, number>>();
assertType<Equal<Parameters<typeof getIDF>, [term: string, documents: readonly string[]]>>();

// The index: search() gives hits, scores() gives numbers.
const index = createIndex(documents);
assertType<Equal<typeof index, BMIndex>>();
const hits = index.search(keywords);
assertType<Equal<typeof hits, BMHit[]>>();
const limitedHits = index.search(keywords, { k1: 1.5, b: 0.5, limit: 10 });
assertType<Equal<typeof limitedHits, BMHit[]>>();
const indexScores = index.scores(keywords, { k1: 1.5 });
assertType<Equal<typeof indexScores, number[]>>();
const configured = createIndex(readonlyDocuments, {
  caseSensitive: true,
  tokenizer: (text) => {
    assertType<Equal<typeof text, string>>();
    return text.split(" ");
  },
});
assertType<Equal<typeof configured, BMIndex>>();
assertType<Equal<ReturnType<typeof configured.search>, BMHit[]>>();
const fromReadonlyKeywords = index.search(readonlyKeywords, readonlyConstants);
assertType<Equal<typeof fromReadonlyKeywords, BMHit[]>>();
// A hit is a scored document with its position, so it fits where a BMDocument is expected.
const asDocuments: BMDocument[] = hits;
assertType<Equal<typeof asDocuments, BMDocument[]>>();
assertType<Equal<BMHit, { document: string; score: number; index: number }>>();
assertType<Equal<BMIndexOptions, { caseSensitive?: boolean; tokenizer?: (text: string) => string[] }>>();
assertType<Equal<BMSearchOptions, { b?: number; k1?: number; limit?: number }>>();

// Mistakes that must not compile.
// @ts-expect-error The index needs documents.
createIndex();
// @ts-expect-error Documents are a list, not one string.
createIndex("a cat");
// @ts-expect-error Unknown options are rejected.
createIndex(documents, { lowercase: true });
// @ts-expect-error A tokenizer returns words, not one string.
createIndex(documents, { tokenizer: (text: string) => text });
// @ts-expect-error Keywords are a list, not one string.
index.search("cat");
// @ts-expect-error The limit is a number.
index.search(keywords, { limit: "10" });
// @ts-expect-error scores() has no limit; it always returns one score per document.
index.scores(keywords, { limit: 10 });
// @ts-expect-error search() returns hits, not numbers.
export const wrongHits: number[] = index.search(keywords);
// @ts-expect-error scores() returns numbers, not hits.
export const wrongIndexScores: BMHit[] = index.scores(keywords);
// @ts-expect-error Documents are required.
BM25();
// @ts-expect-error Keywords are required.
BM25(documents);
// @ts-expect-error Documents are a list, not one string.
BM25("a cat", keywords);
// @ts-expect-error Keywords are a list, not one string.
BM25(documents, "cat");
// @ts-expect-error Documents are strings.
BM25([1, 2, 3], keywords);
// @ts-expect-error Constants are numbers.
BM25(documents, keywords, { k1: "1.2" });
// @ts-expect-error Unknown constants are rejected.
BM25(documents, keywords, { k2: 1.2 });
// @ts-expect-error A sorter returns a number.
BM25(documents, keywords, undefined, (first: BMDocument) => first.document);
// @ts-expect-error A cast cannot turn scores into documents.
export const wrongCastScores = BM25(documents, keywords) as BMDocument[];
// @ts-expect-error A cast cannot turn documents into scores.
export const wrongCastRanked = BM25(documents, keywords, undefined, descending) as number[];
// @ts-expect-error Scores are numbers, not documents.
export const wrongScores: BMDocument[] = BM25(documents, keywords);
// @ts-expect-error Sorted results are documents, not numbers.
export const wrongRanked: number[] = BM25(documents, keywords, undefined, descending);

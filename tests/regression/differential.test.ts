/**
 * Differential regression test.
 *
 * Runs the current implementation and the frozen okapibm25@1.4.1 build on
 * random inputs and requires bit-for-bit identical output.
 *
 * The inputs stay inside the range where 1.4.1 was correct. The places where
 * the two are meant to differ are pinned one by one in
 * tests/behavior_changes.test.ts.
 */
import fc from "fast-check";
import BM25, { getIDF, getTermFrequency, getWordCount } from "../../BM25";
import LegacyBM25, {
  getIDF as legacyGetIDF,
  getTermFrequency as legacyGetTermFrequency,
  getWordCount as legacyGetWordCount,
} from "./legacy-v1.4.1";

const numRuns = Number(process.env.FC_NUM_RUNS) || 500;

/** Characters that mean nothing special in a regular expression. */
const literalCharacters = ["a", "b", "c", "A", "B", "0", "1", "_", " ", "é", "日"];
/** Documents may contain anything, including regular expression syntax. */
const documentCharacters = literalCharacters.concat([
  ".", ",", "\n", "\t", "(", ")", "[", "]", "*", "+", "?", "\\", "$", "^", "|", "-",
]);

/** A keyword 1.4.1 handled correctly: not empty, no regular expression syntax. */
const keyword = fc.string({
  unit: fc.constantFrom(...literalCharacters),
  minLength: 1,
  maxLength: 4,
});
const document = fc.string({
  unit: fc.constantFrom(...documentCharacters),
  maxLength: 60,
});
/** 1.4.1 ignored 0, and b = 1 made it return NaN for documents without words. */
const constants = fc.option(
  fc.record(
    {
      k1: fc.double({ min: 0.01, max: 5, noNaN: true }),
      b: fc.double({ min: 0.01, max: 0.99, noNaN: true }),
    },
    { requiredKeys: [] }
  ),
  { nil: undefined }
);
/** 1.4.1 returned NaN when no document had a countable word. */
const documents = fc
  .array(document, { maxLength: 12 })
  .filter(
    (candidates) =>
      candidates.length === 0 ||
      candidates.some((candidate) => legacyGetWordCount(candidate) > 0)
  );
const keywords = fc.array(keyword, { maxLength: 6 });

describe("current implementation against the frozen okapibm25@1.4.1 build", () => {
  test("scores are identical", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        expect(BM25(docs, query, constant)).toEqual(
          LegacyBM25(docs, query, constant)
        );
      }),
      { numRuns }
    );
  });

  test("scores are identical when a keyword occurs a very large number of times", () => {
    // 300 and 70,000 occurrences: past what 8 and 16 bits can count.
    const docs = ["a".repeat(300), "a b ".repeat(70000), "b", "a"];
    expect(BM25(docs, ["a"])).toEqual(LegacyBM25(docs, ["a"]));
    expect(BM25(docs, ["a", "b"], { k1: 2, b: 0.5 })).toEqual(
      LegacyBM25(docs, ["a", "b"], { k1: 2, b: 0.5 })
    );
    const scores = BM25(docs, ["a"]);
    expect(new Set(scores).size).toBe(4);
  });

  test("sorted results are identical", () => {
    const sorters = [
      (first: { score: number }, second: { score: number }) =>
        second.score - first.score,
      (first: { score: number }, second: { score: number }) =>
        first.score - second.score,
      (first: { document: string }, second: { document: string }) =>
        first.document < second.document ? -1 : first.document > second.document ? 1 : 0,
    ];
    fc.assert(
      fc.property(
        documents,
        keywords,
        constants,
        fc.constantFrom(...sorters),
        (docs, query, constant, sorter) => {
          expect(BM25(docs, query, constant, sorter)).toEqual(
            LegacyBM25(docs, query, constant, sorter)
          );
        }
      ),
      { numRuns }
    );
  });

  test("getWordCount is identical for any string", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.string({ unit: "grapheme" }), document),
        (text) => {
          expect(getWordCount(text)).toBe(legacyGetWordCount(text));
        }
      ),
      { numRuns: numRuns * 2 }
    );
  });

  test("getTermFrequency is identical for literal terms", () => {
    fc.assert(
      fc.property(keyword, document, (term, text) => {
        expect(getTermFrequency(term, text)).toBe(
          legacyGetTermFrequency(term, text)
        );
      }),
      { numRuns: numRuns * 2 }
    );
  });

  test("getIDF is identical for any term", () => {
    fc.assert(
      fc.property(
        fc.oneof(keyword, document),
        fc.array(document, { maxLength: 12 }),
        (term, docs) => {
          expect(getIDF(term, docs)).toBe(legacyGetIDF(term, docs));
        }
      ),
      { numRuns }
    );
  });
});

/**
 * Properties that hold for every input, checked on random data.
 * A failure prints the seed and the smallest input that breaks the property.
 */
import fc from "fast-check";
import BM25, { BMDocument, getTermFrequency } from "../BM25";

const numRuns = Number(process.env.FC_NUM_RUNS) || 500;

/** `§` never appears in a generated document. */
const absentKeyword = "§§";
const characters = [
  "a", "b", "c", "A", "0", "_", " ", "é", "日", ".", "*", "+", "(", "[", "\\", "$", "\n",
];
const text = (maxLength: number) =>
  fc.string({ unit: fc.constantFrom(...characters), maxLength });
const documents = fc.array(text(50), { maxLength: 12 });
const keywords = fc.array(text(4), { maxLength: 6 });
const constants = fc.option(
  fc.record(
    {
      k1: fc.double({ min: 0, max: 5, noNaN: true }),
      b: fc.double({ min: 0, max: 1, noNaN: true }),
    },
    { requiredKeys: [] }
  ),
  { nil: undefined }
);
const descending = (first: BMDocument, second: BMDocument) =>
  second.score - first.score;

describe("properties of BM25", () => {
  test("returns one finite, non-negative score per document", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const scores = BM25(docs, query, constant);
        expect(scores).toHaveLength(docs.length);
        for (const score of scores) {
          expect(Number.isFinite(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns }
    );
  });

  test("a document scores above zero exactly when it contains a keyword", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const scores = BM25(docs, query, constant);
        docs.forEach((doc, index) => {
          const contains = query.some(
            (term) => term.length > 0 && doc.includes(term)
          );
          expect(scores[index] > 0).toBe(contains);
        });
      }),
      { numRuns }
    );
  });

  test("does not change its arguments and gives the same answer twice", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const docsBefore = docs.slice();
        const queryBefore = query.slice();
        const constantBefore = constant ? { ...constant } : constant;
        const first = BM25(docs, query, constant);
        const sorted = BM25(docs, query, constant, descending);
        const second = BM25(docs, query, constant);
        expect(docs).toEqual(docsBefore);
        expect(query).toEqual(queryBefore);
        expect(constant).toEqual(constantBefore);
        expect(second).toEqual(first);
        expect(sorted).toHaveLength(docs.length);
      }),
      { numRuns }
    );
  });

  test("reordering the documents reorders the scores and nothing else", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const forward = BM25(docs, query, constant);
        const backward = BM25(docs.slice().reverse(), query, constant);
        expect(backward.reverse()).toEqual(forward);
      }),
      { numRuns }
    );
  });

  test("a keyword found in no document changes nothing", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        expect(BM25(docs, query.concat(absentKeyword), constant)).toEqual(
          BM25(docs, query, constant)
        );
        expect(BM25(docs, [absentKeyword].concat(query), constant)).toEqual(
          BM25(docs, query, constant)
        );
      }),
      { numRuns }
    );
  });

  test("repeating a keyword doubles its score", () => {
    fc.assert(
      fc.property(documents, text(4), constants, (docs, term, constant) => {
        const once = BM25(docs, [term], constant);
        const twice = BM25(docs, [term, term], constant);
        expect(twice).toEqual(once.map((score) => score + score));
      }),
      { numRuns }
    );
  });

  test("the score of a query is the sum of the scores of its keywords", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const together = BM25(docs, query, constant);
        const apart = docs.map(() => 0);
        for (const term of query) {
          BM25(docs, [term], constant).forEach((score, index) => {
            apart[index] += score;
          });
        }
        expect(together).toEqual(apart);
      }),
      { numRuns }
    );
  });

  test("sorting returns every document once, paired with its score", () => {
    fc.assert(
      fc.property(documents, keywords, constants, (docs, query, constant) => {
        const scores = BM25(docs, query, constant);
        const ranked = BM25(docs, query, constant, descending);
        for (let index = 1; index < ranked.length; index++) {
          expect(ranked[index - 1].score).toBeGreaterThanOrEqual(
            ranked[index].score
          );
        }
        const byPosition = docs
          .map((document, index) => ({ document, score: scores[index] }))
          .sort(descending);
        expect(ranked).toEqual(byPosition);
      }),
      { numRuns }
    );
  });

  test("with b = 0, a more frequent keyword never scores lower", () => {
    fc.assert(
      fc.property(
        documents,
        text(4),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (docs, term, k1) => {
          const scores = BM25(docs, [term], { k1, b: 0 });
          const frequencies = docs.map((doc) => getTermFrequency(term, doc));
          for (let first = 0; first < docs.length; first++) {
            for (let second = 0; second < docs.length; second++) {
              if (frequencies[first] >= frequencies[second]) {
                // Allow for rounding in the last bits.
                expect(scores[first]).toBeGreaterThanOrEqual(
                  scores[second] - 1e-12
                );
              }
            }
          }
        }
      ),
      { numRuns }
    );
  });

  test("getTermFrequency counts what String.split counts", () => {
    fc.assert(
      fc.property(text(4), text(60), (term, corpus) => {
        fc.pre(term.length > 0);
        expect(getTermFrequency(term, corpus)).toBe(
          corpus.split(term).length - 1
        );
      }),
      { numRuns: numRuns * 2 }
    );
  });
});

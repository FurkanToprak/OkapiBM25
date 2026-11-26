/**
 * Every place where the current implementation is meant to differ from
 * okapibm25@1.4.1. Each test shows what 1.4.1 did and what happens now, so a
 * difference that is not listed here is a regression.
 */
import BM25, { getTermFrequency } from "../BM25";
import LegacyBM25, {
  getTermFrequency as legacyGetTermFrequency,
} from "./regression/legacy-v1.4.1";

describe("intended differences from okapibm25@1.4.1", () => {
  describe("k1 = 0 and b = 0 are honoured", () => {
    const documents = ["dog", "dog dog dog cat", "cat cat cat cat cat cat dog"];
    const query = ["dog"];

    test("1.4.1 replaced 0 with the default", () => {
      expect(LegacyBM25(documents, query, { k1: 0, b: 0 })).toEqual(
        LegacyBM25(documents, query)
      );
    });

    test("k1 = 0 scores every matching document with the plain IDF", () => {
      const idf = Math.log((3 - 3 + 0.5) / (3 + 0.5) + 1);
      const scores = BM25(documents, query, { k1: 0 });
      expect(scores).toHaveLength(3);
      scores.forEach((score) => expect(score).toBeCloseTo(idf, 12));
    });

    test("b = 0 ignores document length", () => {
      const scores = BM25(["dog", "dog cat cat cat cat cat"], query, { b: 0 });
      expect(scores[0]).toBe(scores[1]);
      const defaults = BM25(["dog", "dog cat cat cat cat cat"], query);
      expect(defaults[0]).toBeGreaterThan(defaults[1]);
    });
  });

  describe("keywords are literal text, not regular expressions", () => {
    test("1.4.1 threw on keywords that are not valid regular expressions", () => {
      expect(() => LegacyBM25(["c++ and c#"], ["c++"])).toThrow(SyntaxError);
      expect(() => LegacyBM25(["f(x)"], ["("])).toThrow(SyntaxError);
    });

    test("such keywords are now matched as written", () => {
      expect(BM25(["c++ and c#", "c and d"], ["c++"])).toEqual([
        expect.any(Number),
        0,
      ]);
      expect(BM25(["c++ and c#", "c and d"], ["c++"])[0]).toBeGreaterThan(0);
      expect(BM25(["f(x)", "fx"], ["("])[0]).toBeGreaterThan(0);
    });

    test("1.4.1 let `.` match any character when counting", () => {
      expect(legacyGetTermFrequency("a.c", "abc a.c")).toBe(2);
      expect(getTermFrequency("a.c", "abc a.c")).toBe(1);
    });

    test("a keyword now scores only the documents that contain it", () => {
      // 1.4.1 counted `query.` in "query!" but took the IDF from documents containing the literal text.
      expect((LegacyBM25(["query!", "other"], ["query."]) as number[])[0]).toBeGreaterThan(0);
      expect(BM25(["query!", "other"], ["query."])).toEqual([0, 0]);
    });
  });

  describe("an empty keyword contributes nothing", () => {
    test("1.4.1 counted an empty keyword once per character", () => {
      expect(legacyGetTermFrequency("", "abc")).toBe(4);
      expect((LegacyBM25(["abc", "de"], [""]) as number[])[0]).toBeGreaterThan(0);
    });

    test("it now scores zero", () => {
      expect(getTermFrequency("", "abc")).toBe(0);
      expect(BM25(["abc", "de"], [""])).toEqual([0, 0]);
      expect(BM25(["abc", "de"], ["", "abc"])).toEqual(BM25(["abc", "de"], ["abc"]));
    });
  });

  describe("scores are never NaN", () => {
    test("1.4.1 returned NaN when no document had a countable word", () => {
      expect(LegacyBM25(["", ""], ["a"])).toEqual([NaN, NaN]);
      expect(LegacyBM25(["日本語の文書", "別の文書"], ["日本語"])).toEqual([NaN, NaN]);
    });

    test("such collections are now scored without length normalization", () => {
      expect(BM25(["", ""], ["a"])).toEqual([0, 0]);
      const scores = BM25(["日本語の文書", "別の文書"], ["日本語"]);
      expect(scores[0]).toBeGreaterThan(0);
      expect(scores[1]).toBe(0);
    });

    test("every document in such a collection counts as being of average length", () => {
      // With nothing to normalize by, the length factor is k1 whatever b is.
      const idf = Math.log(1 + (2 - 1 + 0.5) / (1 + 0.5));
      const expected = (idf * 2 * (1.2 + 1)) / (2 + 1.2);
      for (const b of [0, 0.3, 0.75, 1]) {
        const scores = BM25(["日本語と日本語", "別の文書"], ["日本語"], { k1: 1.2, b });
        expect(scores[0]).toBeCloseTo(expected, 12);
        expect(scores[1]).toBe(0);
      }
    });

    test("1.4.1 returned NaN for a wordless document when b = 1", () => {
      expect(LegacyBM25(["", "a b"], ["zzz"], { b: 1 })).toEqual([NaN, 0]);
      expect(BM25(["", "a b"], ["zzz"], { b: 1 })).toEqual([0, 0]);
    });
  });

  describe("k1 and b are used only when they are numbers", () => {
    const documents = ["a b", "a c d", "e"];

    test("1.4.1 did arithmetic on strings", () => {
      // "2" + 1 is "21", so k1: "2" behaved like a k1 of about 21 in one place and 2 in another.
      const legacy = LegacyBM25(documents, ["a"], { k1: "2" as unknown as number }) as number[];
      expect(legacy).not.toEqual(LegacyBM25(documents, ["a"], { k1: 2 }));
      // b: "0.1" happened to work, because b is only ever multiplied and subtracted.
      expect(LegacyBM25(documents, ["a"], { b: "0.1" as unknown as number })).toEqual(
        LegacyBM25(documents, ["a"], { b: 0.1 })
      );
    });

    test("anything that is not a number now falls back to the default", () => {
      const defaults = BM25(documents, ["a"]);
      expect(BM25(documents, ["a"], { k1: "2" as unknown as number })).toEqual(defaults);
      expect(BM25(documents, ["a"], { b: "0.1" as unknown as number })).toEqual(defaults);
    });
  });

  describe("keywords that are not text", () => {
    test("1.4.1 turned null and undefined into patterns", () => {
      const fromJavaScript = [null] as unknown as string[];
      expect((LegacyBM25(["null and void", "other"], fromJavaScript) as number[])[0]).toBeGreaterThan(0);
    });

    test("only strings and numbers are searched for now", () => {
      const fromJavaScript = [null, undefined] as unknown as string[];
      expect(BM25(["null and void", "undefined"], fromJavaScript)).toEqual([0, 0]);
    });
  });

  describe("documents that are not strings are treated as empty", () => {
    test("1.4.1 threw on a null document", () => {
      // @ts-expect-error JavaScript callers may pass null.
      expect(() => LegacyBM25(["a", null], ["a"])).toThrow(TypeError);
    });

    test("it now scores zero", () => {
      // @ts-expect-error JavaScript callers may pass null.
      const scores = BM25(["a", null, undefined, 7], ["a"]);
      expect(scores[0]).toBeGreaterThan(0);
      expect(scores.slice(1)).toEqual([0, 0, 0]);
    });

    test("sorted results carry the value that was passed in", () => {
      const fromJavaScript = ["a", null, 7] as unknown as string[];
      const results = BM25(fromJavaScript, ["a"], undefined, () => 0);
      expect(results.map((result) => result.document)).toEqual(["a", null, 7]);
    });
  });
});

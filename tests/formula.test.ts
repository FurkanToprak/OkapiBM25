/**
 * Checks the scores against the BM25 formula, worked out two ways that share
 * no code with the implementation: by a textbook implementation over
 * whitespace tokens, and by numbers computed by hand.
 */
import BM25, { getIDF, getTermFrequency, getWordCount } from "../BM25";

/** Textbook BM25 over whitespace tokens. Only valid when no keyword is part of a longer word. */
const textbook = (
  documents: string[],
  keywords: string[],
  k1: number,
  b: number
): number[] => {
  const tokenized = documents.map((document) =>
    document.split(" ").filter((token) => token !== "")
  );
  const averageLength =
    tokenized.reduce((total, tokens) => total + tokens.length, 0) /
    tokenized.length;
  return tokenized.map((tokens) => {
    let score = 0;
    for (const keyword of keywords) {
      const containing = tokenized.filter((other) => other.includes(keyword)).length;
      const idf = Math.log(
        1 + (tokenized.length - containing + 0.5) / (containing + 0.5)
      );
      const frequency = tokens.filter((token) => token === keyword).length;
      if (frequency === 0) {
        continue;
      }
      score +=
        (idf * frequency * (k1 + 1)) /
        (frequency + k1 * (1 - b + (b * tokens.length) / averageLength));
    }
    return score;
  });
};

const expectClose = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((score, index) => expect(score).toBeCloseTo(expected[index], 12));
};

describe("BM25 formula", () => {
  const documents = [
    "red green blue",
    "red red green yellow yellow yellow",
    "blue",
    "purple orange red blue blue pink white black",
    "white",
  ];

  test.each([
    [["red"], 1.2, 0.75],
    [["red", "blue"], 1.2, 0.75],
    [["yellow", "white", "missing"], 2, 0.5],
    [["blue", "blue", "green"], 0.6, 1],
    [["red", "green", "blue", "yellow", "white"], 1.8, 0],
    [["pink"], 0, 0.75],
  ] as Array<[string[], number, number]>)(
    "matches the textbook formula for %j with k1 = %d and b = %d",
    (keywords, k1, b) => {
      expectClose(BM25(documents, keywords, { k1, b }), textbook(documents, keywords, k1, b));
    }
  );

  test("defaults are k1 = 1.2 and b = 0.75", () => {
    expectClose(BM25(documents, ["red", "blue"]), textbook(documents, ["red", "blue"], 1.2, 0.75));
    expectClose(BM25(documents, ["red", "blue"], {}), textbook(documents, ["red", "blue"], 1.2, 0.75));
    expectClose(BM25(documents, ["red", "blue"], { k1: 2 }), textbook(documents, ["red", "blue"], 2, 0.75));
    expectClose(BM25(documents, ["red", "blue"], { b: 0.2 }), textbook(documents, ["red", "blue"], 1.2, 0.2));
  });

  test("values that are not numbers fall back to the defaults", () => {
    const defaults = BM25(documents, ["red", "blue"]);
    // @ts-expect-error
    expect(BM25(documents, ["red", "blue"], null)).toEqual(defaults);
    // @ts-expect-error
    expect(BM25(documents, ["red", "blue"], { k1: null, b: null })).toEqual(defaults);
    // @ts-expect-error
    expect(BM25(documents, ["red", "blue"], { k1: "2", b: "0.1" })).toEqual(defaults);
    expect(BM25(documents, ["red", "blue"], { k1: NaN, b: NaN })).toEqual(defaults);
    expect(BM25(documents, ["red", "blue"], { k1: undefined, b: undefined })).toEqual(defaults);
  });

  test("a worked example", () => {
    // Three documents of 3, 3 and 1 words: average length 7/3.
    // "a" is in two of them: IDF = ln(1 + (3 - 2 + 0.5) / (2 + 0.5)) = ln(1.6).
    // Length factor for 3 words = 1.2 * (0.25 + 0.75 * 3 / (7/3)) = 1.2 * 17/14.
    // Document 1 has "a" once:  ln(1.6) * 1 * 2.2 / (1 + 1.2 * 17/14)
    // Document 2 has "a" twice: ln(1.6) * 2 * 2.2 / (2 + 1.2 * 17/14)
    const scores = BM25(["a b c", "a a b", "c"], ["a"]);
    expect(scores[0]).toBeCloseTo(0.42081720292932, 12);
    expect(scores[1]).toBeCloseTo(0.59818643722185, 12);
    expect(scores[2]).toBe(0);
  });
});

describe("helpers", () => {
  test("getWordCount counts runs of ASCII letters, digits and underscores", () => {
    expect(getWordCount("")).toBe(0);
    expect(getWordCount("   ")).toBe(0);
    expect(getWordCount("one")).toBe(1);
    expect(getWordCount(" one  two\tthree\nfour ")).toBe(4);
    expect(getWordCount("snake_case kebab-case camelCase")).toBe(4);
    expect(getWordCount("3.14 is 2nd")).toBe(4);
    expect(getWordCount("don't stop")).toBe(3);
    expect(getWordCount("...!?")).toBe(0);
    expect(getWordCount("@`[{/:")).toBe(0);
    expect(getWordCount("azAZ09_")).toBe(1);
  });

  test("getWordCount does not count letters outside ASCII", () => {
    // Pinned on purpose: changing this changes every score for non-English text.
    expect(getWordCount("日本語")).toBe(0);
    expect(getWordCount("café")).toBe(1);
    expect(getWordCount("naïve")).toBe(2);
    expect(getWordCount("привет мир")).toBe(0);
  });

  test("getTermFrequency counts occurrences that do not overlap", () => {
    expect(getTermFrequency("aa", "aaaa")).toBe(2);
    expect(getTermFrequency("aa", "aaa")).toBe(1);
    expect(getTermFrequency("aba", "ababababa")).toBe(2);
    expect(getTermFrequency("a", "")).toBe(0);
    expect(getTermFrequency("abc", "abc")).toBe(1);
    expect(getTermFrequency("abcd", "abc")).toBe(0);
  });

  test("getTermFrequency is case-sensitive and matches inside words", () => {
    expect(getTermFrequency("cat", "Cat cat CAT concatenate")).toBe(2);
    expect(getTermFrequency("new york", "new york, new  york")).toBe(1);
  });

  test("getIDF is higher for rarer terms and never negative", () => {
    const documents = ["a b", "a c", "a d", "a e"];
    expect(getIDF("a", documents)).toBeCloseTo(Math.log(1 + 0.5 / 4.5), 12);
    expect(getIDF("b", documents)).toBeCloseTo(Math.log(1 + 3.5 / 1.5), 12);
    expect(getIDF("z", documents)).toBeCloseTo(Math.log(1 + 4.5 / 0.5), 12);
    expect(getIDF("a", documents)).toBeGreaterThan(0);
    expect(getIDF("a", documents)).toBeLessThan(getIDF("b", documents));
    expect(getIDF("b", documents)).toBeLessThan(getIDF("z", documents));
    expect(getIDF("a", [])).toBeCloseTo(Math.log(2), 12);
  });
});

describe("empty and degenerate input", () => {
  const descending = (first: { score: number }, second: { score: number }) =>
    second.score - first.score;

  test("no documents", () => {
    expect(BM25([], ["a"])).toEqual([]);
    expect(BM25([], [])).toEqual([]);
    expect(BM25([], ["a"], undefined, descending)).toEqual([]);
  });

  test("no keywords", () => {
    expect(BM25(["a", "b"], [])).toEqual([0, 0]);
    expect(BM25(["a", "b"], [], undefined, descending)).toEqual([
      { document: "a", score: 0 },
      { document: "b", score: 0 },
    ]);
  });

  test("a single document", () => {
    const [score] = BM25(["only one"], ["one"]);
    expect(score).toBeCloseTo((Math.log(1 + 0.5 / 1.5) * 2.2) / (1 + 1.2), 12);
  });

  test("empty documents among others score zero", () => {
    expect(BM25(["", "a", ""], ["a"])).toEqual([0, expect.any(Number), 0]);
    expect(BM25(["", "a", ""], ["a"], { b: 1 })[1]).toBeGreaterThan(0);
  });

  test("identical documents get identical scores", () => {
    const scores = BM25(["same text", "same text", "same text"], ["same", "text"]);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(scores[0]);
    expect(scores[2]).toBe(scores[0]);
  });
});

describe("sorting", () => {
  const documents = ["b tie", "a tie", "c tie tie", "d none"];

  test("results pair each document with its score", () => {
    const scores = BM25(documents, ["tie"]);
    const results = BM25(documents, ["tie"], undefined, () => 0);
    expect(results).toEqual(
      documents.map((document, index) => ({ document, score: scores[index] }))
    );
    expect(Object.keys(results[0]).sort()).toEqual(["document", "score"]);
  });

  test("documents with equal scores keep their original order", () => {
    const ranked = BM25(documents, ["tie"], undefined, (first, second) => second.score - first.score);
    expect(ranked.map((result) => result.document)).toEqual([
      "c tie tie",
      "b tie",
      "a tie",
      "d none",
    ]);
  });

  test("the sorter may ignore scores", () => {
    const ranked = BM25(documents, ["tie"], undefined, (first, second) =>
      first.document.localeCompare(second.document)
    );
    expect(ranked.map((result) => result.document)).toEqual([
      "a tie",
      "b tie",
      "c tie tie",
      "d none",
    ]);
  });

  test("the input array is not reordered", () => {
    const input = documents.slice();
    BM25(input, ["tie"], undefined, (first, second) => second.score - first.score);
    expect(input).toEqual(documents);
  });

  test("frozen arrays are accepted", () => {
    const frozenDocuments = Object.freeze(documents.slice());
    const frozenKeywords = Object.freeze(["tie"]);
    expect(BM25(frozenDocuments, frozenKeywords)).toEqual(BM25(documents, ["tie"]));
    expect(
      BM25(frozenDocuments, frozenKeywords, Object.freeze({ k1: 1.2 }), () => 0)
    ).toHaveLength(4);
  });
});

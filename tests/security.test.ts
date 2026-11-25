/**
 * Keywords usually come straight from a user's search box. These tests pin
 * that no keyword can throw, stall the event loop or reach object internals.
 */
import BM25, { getIDF, getTermFrequency, getWordCount } from "../BM25";
import LegacyBM25 from "./regression/legacy-v1.4.1";

const metacharacterKeywords = [
  "c++", "(", ")", "[", "]", "{", "}", "*", "+", "?", ".", "^", "$", "|", "\\",
  "\\d", "a{2", "[a-", "(?<name>", "(?=x)", "a|b", ".*", "\\\\", "/", "$&", "$1",
];

describe("keywords are never run as regular expressions", () => {
  test.each(metacharacterKeywords)("%s does not throw and matches itself only", (keyword) => {
    const documents = [`before ${keyword} after`, "abcdefghij 0123456789", ""];
    const scores = BM25(documents, [keyword]);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
    expect(scores[2]).toBe(0);
    expect(getTermFrequency(keyword, documents[0])).toBe(1);
    expect(getTermFrequency(keyword, documents[1])).toBe(0);
    expect(Number.isFinite(getIDF(keyword, documents))).toBe(true);
  });

  test("a keyword built for catastrophic backtracking returns at once", () => {
    // As a regular expression, each of these needs billions of steps on this document.
    const document = "a".repeat(64) + "!";
    const keywords = ["(a+)+$", "(a|aa)+$", "(a*)*b", "^(a+)+$", "(.*a){20}"];
    const started = Date.now();
    const scores = BM25([document, "other"], keywords);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(scores).toEqual([0, 0]);
  });

  test("replacement patterns in a keyword are not expanded", () => {
    expect(getTermFrequency("$&", "a $& b $& c")).toBe(2);
    expect(getTermFrequency("$1", "price: $1")).toBe(1);
  });
});

describe("large and awkward inputs", () => {
  test("a keyword longer than every document scores zero", () => {
    expect(BM25(["short", "text"], ["x".repeat(10000)])).toEqual([0, 0]);
  });

  test("a very long document is scored in one pass", () => {
    const long = "needle hay ".repeat(100000);
    const started = Date.now();
    const scores = BM25([long, "hay"], ["needle"]);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
    expect(getTermFrequency("needle", long)).toBe(100000);
    expect(getWordCount(long)).toBe(200000);
  });

  test("many keywords and many documents stay finite", () => {
    const documents = Array.from({ length: 2000 }, (_, index) => `doc ${index} word${index % 7}`);
    const keywords = Array.from({ length: 200 }, (_, index) => `word${index % 9}`);
    const scores = BM25(documents, keywords);
    expect(scores).toHaveLength(2000);
    expect(scores.every((score) => Number.isFinite(score) && score >= 0)).toBe(true);
  });

  test("lone surrogates, null characters and astral characters are ordinary text", () => {
    const documents = ["a\u0000b", "😀 smile", "\ud800 broken", "plain"];
    expect(BM25(documents, ["\u0000"])[0]).toBeGreaterThan(0);
    expect(BM25(documents, ["😀"])[1]).toBeGreaterThan(0);
    expect(BM25(documents, ["\ud800"])[2]).toBeGreaterThan(0);
    expect(BM25(documents, ["\u0000", "😀", "\ud800"])[3]).toBe(0);
  });
});

describe("keywords that are property names", () => {
  const propertyNames = ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "valueOf", "length"];

  test.each(propertyNames)("%s is scored like any other word", (keyword) => {
    const scores = BM25([`the ${keyword} word`, "nothing here"], [keyword]);
    expect(typeof scores[0]).toBe("number");
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
  });

  test("scoring leaves Object.prototype untouched", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    BM25(propertyNames.map((name) => `${name} text`), propertyNames);
    BM25(["__proto__"], ["__proto__"], JSON.parse('{"__proto__": {"k1": 99, "polluted": true}}'));
    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("arguments of the wrong type", () => {
  test("documents and keywords must be arrays", () => {
    // @ts-expect-error A string is not a list of documents.
    expect(() => BM25("a document", ["a"])).toThrow(new TypeError("BM25: `documents` must be an array of strings."));
    // @ts-expect-error
    expect(() => BM25(undefined, ["a"])).toThrow(TypeError);
    // @ts-expect-error A string is not a list of keywords.
    expect(() => BM25(["a document"], "a")).toThrow(new TypeError("BM25: `keywords` must be an array of strings."));
    // @ts-expect-error
    expect(() => BM25(["a document"], null)).toThrow(TypeError);
  });

  test("keywords that are neither strings nor numbers contribute nothing", () => {
    // @ts-expect-error JavaScript callers may pass anything.
    expect(BM25(["1 a", "null undefined true"], [null, undefined, true, {}, ["a"]])).toEqual([0, 0]);
  });

  test("a number passed as a keyword is searched as text, as in 1.4.1", () => {
    const fromJavaScript = [2024, 1.5] as unknown as string[];
    const documents = ["released in 2024", "version 1.5", "neither"];
    expect(BM25(documents, fromJavaScript)).toEqual(BM25(documents, ["2024", "1.5"]));
    expect(BM25(documents, fromJavaScript)[0]).toBeGreaterThan(0);
    expect(BM25(documents, [2024] as unknown as string[])).toEqual(
      LegacyBM25(documents, [2024] as unknown as string[])
    );
  });

  test("helpers accept values that are not strings", () => {
    // @ts-expect-error
    expect(getWordCount(undefined)).toBe(0);
    // @ts-expect-error
    expect(getWordCount(42)).toBe(0);
    // @ts-expect-error
    expect(getTermFrequency(null, "null")).toBe(0);
    // @ts-expect-error
    expect(getTermFrequency("a", 42)).toBe(0);
    // @ts-expect-error
    expect(getIDF("a", ["a", null])).toBeCloseTo(Math.log(1.5 / 1.5 + 1), 12);
  });
});

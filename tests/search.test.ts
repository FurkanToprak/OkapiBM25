/**
 * Tests for what `BM25(documents, options)` returns: an object that searches
 * the documents by whole words. By default it builds an index once; with
 * `{ index: false }` it reads the documents at every search. Both must give
 * the same results, so every test in the first part of this file runs for
 * both, and for `createIndex`, the name the indexed form had in 2.1.0.
 *
 * The scoring formula is that of the older call, `BM25(documents, keywords)`,
 * so wherever the two match the same words they must give identical scores.
 */
import vm from "vm";
import fc from "fast-check";
import BM25, { BMHit, BMOptions, BMSearcher, createIndex } from "../BM25";

const documents = [
  "The quick brown fox jumps over the lazy dog",
  "A quick guide to training your dog",
  "Stock markets fell sharply on Monday",
];

type Make = (documents: readonly string[], options?: BMOptions) => BMSearcher;
/** Name, how to make a searcher, and whether it reads the documents when it is made. */
const forms: [string, Make, boolean][] = [
  ["BM25(documents)", (texts, options) => BM25(texts, options), true],
  ["BM25(documents, { index: false })", (texts, options) => BM25(texts, { ...options, index: false }), false],
  ["createIndex(documents)", (texts, options) => createIndex(texts, options), true],
];

describe.each(forms)("%s", (_form, make, readsWhenMade) => {

  describe("searching", () => {
    it("returns the matching documents, best match first", () => {
      const hits = make(documents).search(["quick", "dog"]);
      expect(hits.map((hit) => hit.index)).toEqual([1, 0]);
      expect(hits[0].document).toBe(documents[1]);
      expect(hits[0].score).toBeGreaterThan(hits[1].score);
      expect(hits[1].score).toBeGreaterThan(0);
    });

    it("leaves out documents that contain none of the keywords", () => {
      expect(make(documents).search(["zebra"])).toEqual([]);
      expect(make(documents).search([])).toEqual([]);
      expect(make([]).search(["dog"])).toEqual([]);
    });

    it("gives one score per document with scores()", () => {
      const index = make(documents);
      const scores = index.scores(["quick", "dog"]);
      expect(scores).toHaveLength(3);
      expect(scores[2]).toBe(0);
      const hits = index.search(["quick", "dog"]);
      for (const hit of hits) {
        expect(hit.score).toBe(scores[hit.index]);
      }
      expect(make([]).scores(["dog"])).toEqual([]);
      expect(index.scores([])).toEqual([0, 0, 0]);
    });

    it("gives the scores of BM25 for the same words", () => {
      const index = make(documents, { caseSensitive: true });
      expect(index.scores(["quick", "dog"])).toEqual(BM25(documents, ["quick", "dog"]));
      expect(index.scores(["quick", "dog"], { k1: 1.5, b: 0.5 })).toEqual(
        BM25(documents, ["quick", "dog"], { k1: 1.5, b: 0.5 })
      );
      expect(index.scores(["quick"], { k1: 0, b: 0 })).toEqual(
        BM25(documents, ["quick"], { k1: 0, b: 0 })
      );
    });

    it("uses k1 and b from the search options", () => {
      const index = make(documents);
      const tuned = index.search(["quick", "dog"], { k1: 1.5, b: 0.5 });
      const expected = index.scores(["quick", "dog"], { k1: 1.5, b: 0.5 });
      expect(tuned.map((hit) => hit.score)).toEqual([expected[1], expected[0]]);
      expect(tuned[0].score).not.toBe(index.search(["quick", "dog"])[0].score);
    });

    it("counts a word that occurs several times in a document", () => {
      const repeated = ["dog dog dog cat", "dog cat", "cat"];
      expect(make(repeated).scores(["dog"])).toEqual(BM25(repeated, ["dog"]));
    });

    it("counts a keyword that is given twice, twice", () => {
      const index = make(documents);
      const once = index.scores(["dog"]);
      const twice = index.scores(["dog", "dog"]);
      expect(twice[0]).toBe(once[0] + once[0]);
    });
  });

  describe("whole words", () => {
    it("matches whole words, where BM25 matches inside words", () => {
      const texts = ["concatenate strings", "a cat sat", "a dog"];
      expect(BM25(texts, ["cat"])[0]).toBeGreaterThan(0);
      expect(make(texts).search(["cat"]).map((hit) => hit.index)).toEqual([1]);
    });

    it("splits keywords into words the same way as documents", () => {
      const index = make(documents);
      expect(index.scores(["dog?"])).toEqual(index.scores(["dog"]));
      expect(index.scores(["  dog,  "])).toEqual(index.scores(["dog"]));
      expect(index.scores(["quick dog"])).toEqual(index.scores(["quick", "dog"]));
    });

    it("treats punctuation as a gap between words", () => {
      const index = make(["I write c++ and c", "plain text"]);
      // "c++" is the word "c" to the index. It occurs twice in the first document.
      expect(index.scores(["c++"])).toEqual(index.scores(["c"]));
      expect(index.search(["c++"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["++"])).toEqual([]);
      expect(index.search([""])).toEqual([]);
    });

    it("finds words that are also names of object properties", () => {
      const names = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];
      const index = make(["the constructor of __proto__", "toString and hasOwnProperty", "nothing"]);
      expect(index.search(["constructor"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["__proto__"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["hasOwnProperty"]).map((hit) => hit.index)).toEqual([1]);
      expect(index.search(["valueOf"])).toEqual([]);
      // An index without those words finds nothing and does not throw.
      const plain = make(["a dog", "a cat"]);
      for (const name of names) {
        expect(plain.search([name])).toEqual([]);
        expect(plain.scores([name])).toEqual([0, 0]);
      }
    });
  });

  describe("case", () => {
    it("ignores case by default", () => {
      const index = make(["The DOG barks", "a Dog sleeps", "a cat"]);
      expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0, 1]);
      expect(index.scores(["DOG"])).toEqual(index.scores(["dog"]));
    });

    it("returns the document as it was given, not lowercased", () => {
      expect(make(["The DOG barks"]).search(["dog"])[0].document).toBe("The DOG barks");
    });

    it("tells case apart with caseSensitive", () => {
      const index = make(["The DOG barks", "a Dog sleeps", "a dog"], { caseSensitive: true });
      expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([2]);
      expect(index.search(["DOG"]).map((hit) => hit.index)).toEqual([0]);
    });

    it("ignores case unless caseSensitive is exactly true", () => {
      const options = { caseSensitive: "yes" } as unknown as { caseSensitive: boolean };
      expect(make(["A DOG"], options).search(["dog"])).toHaveLength(1);
      expect(make(["A DOG"], {}).search(["dog"])).toHaveLength(1);
    });
  });

  describe("limit and order", () => {
    const many = ["dog", "dog dog", "cat", "dog cat", "dog"];

    it("returns at most `limit` results", () => {
      const index = make(many);
      const all = index.search(["dog"]);
      expect(all).toHaveLength(4);
      expect(index.search(["dog"], { limit: 2 })).toEqual(all.slice(0, 2));
      expect(index.search(["dog"], { limit: 0 })).toEqual([]);
      expect(index.search(["dog"], { limit: 100 })).toEqual(all);
      expect(index.search(["dog"], { limit: 2.9 })).toEqual(all.slice(0, 2));
      expect(index.search(["dog"], { limit: Infinity })).toEqual(all);
    });

    it("returns everything when no limit is given", () => {
      const index = make(many);
      const all = index.search(["dog"]);
      expect(index.search(["dog"], {})).toEqual(all);
      expect(index.search(["dog"], { limit: undefined })).toEqual(all);
      expect(index.search(["dog"], undefined)).toEqual(all);
    });

    it("rejects a limit that is not a number of results", () => {
      const index = make(many);
      expect(() => index.search(["dog"], { limit: -1 })).toThrow(RangeError);
      expect(() => index.search(["dog"], { limit: NaN })).toThrow(RangeError);
      expect(() => index.search(["dog"], { limit: "2" as unknown as number })).toThrow(TypeError);
      expect(() => index.search(["dog"], { limit: null as unknown as number })).toThrow(TypeError);
      expect(() => index.search(["dog"], { limit: -1 })).toThrow("`limit` must be a number, 0 or more");
    });

    it("keeps the indexed order for documents with equal scores", () => {
      // Documents 0 and 4 are identical, so their scores are equal.
      const hits = make(many).search(["dog"]);
      const first = hits.findIndex((hit) => hit.index === 0);
      const second = hits.findIndex((hit) => hit.index === 4);
      expect(hits[first].score).toBe(hits[second].score);
      expect(first).toBeLessThan(second);
      // The same holds when a later keyword is what finds the earlier document.
      const reversed = make(["cat", "dog", "cat", "dog"]).search(["dog", "cat"]);
      expect(reversed.map((hit) => hit.index)).toEqual([0, 1, 2, 3]);
    });
  });

  describe("a snapshot of the documents", () => {
    it("does not change when the array changes afterwards", () => {
      const texts = ["a dog", "a cat"];
      const index = make(texts);
      texts[0] = "a bird";
      texts.push("another dog");
      expect(index.search(["dog"])).toEqual([{ index: 0, document: "a dog", score: expect.any(Number) }]);
      expect(index.scores(["bird"])).toEqual([0, 0]);
    });

    it("scores documents that are not strings as empty", () => {
      const texts = ["a dog", null, 42, undefined, { text: "dog" }] as unknown as string[];
      const index = make(texts);
      expect(index.scores(["dog"])).toEqual(BM25(texts, ["dog"]));
      expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["42"])).toEqual([]);
    });

    it("never returns NaN, also when no document has a word", () => {
      const wordless = ["", "...", "!? —"];
      const index = make(wordless);
      expect(index.scores(["dog", "!?", "..."])).toEqual([0, 0, 0]);
      expect(index.search(["..."])).toEqual([]);
    });

    it("starts every search from zero", () => {
      // Searches share working memory inside the index. Nothing may be left
      // behind by an earlier search, whichever method ran before.
      const index = make(documents);
      const dog = index.scores(["dog"]);
      const markets = index.scores(["markets"]);
      index.search(["dog", "quick", "markets"]);
      expect(index.scores(["markets"])).toEqual(markets);
      index.scores(["dog", "quick", "markets"]);
      expect(index.search(["markets"]).map((hit) => hit.score)).toEqual([markets[2]]);
      expect(index.scores(["dog"])).toEqual(dog);
      expect(index.scores(["zebra"])).toEqual([0, 0, 0]);
    });

    it("works as before after a search that threw", () => {
      const index = make(documents);
      const before = index.scores(["dog"]);
      expect(() => index.search(["dog"], { k1: -1 })).toThrow(RangeError);
      expect(() => index.scores(["dog"], { b: 2 })).toThrow(RangeError);
      expect(() => index.search(["dog"], { limit: -1 })).toThrow(RangeError);
      expect(index.scores(["dog"])).toEqual(before);
    });
  });

  describe("words in any script", () => {
    it("keeps accented words whole", () => {
      const index = make(["un café noir", "the caf is closed", "École normale"]);
      expect(index.search(["café"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["caf"]).map((hit) => hit.index)).toEqual([1]);
      expect(index.search(["école"]).map((hit) => hit.index)).toEqual([2]);
      expect(index.search(["cole"])).toEqual([]);
    });

    it("keeps a letter and its combining mark together", () => {
      // "é" written as "e" followed by U+0301, and Devanagari with vowel signs.
      const index = make(["café noir", "हिन्दी भाषा"]);
      expect(index.search(["café"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["cafe"])).toEqual([]);
      expect(index.search(["हिन्दी"]).map((hit) => hit.index)).toEqual([1]);
    });

    it("ignores case in other scripts too", () => {
      const index = make(["МОСКВА и Санкт-Петербург", "Αθήνα"]);
      expect(index.search(["москва"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["петербург"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["ΑΘΉΝΑ"]).map((hit) => hit.index)).toEqual([1]);
    });

    it("treats punctuation of any script as a gap between words", () => {
      const index = make(["“dog” — cat…", "«chien»", "¿perro?", "犬、猫。"]);
      expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["cat"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["chien"]).map((hit) => hit.index)).toEqual([1]);
      expect(index.search(["perro"]).map((hit) => hit.index)).toEqual([2]);
      expect(index.search(["猫"]).map((hit) => hit.index)).toEqual([3]);
    });

    it("counts digits and underscores as parts of words", () => {
      const index = make(["version_2 of ٣٤ files", "version 2"]);
      expect(index.search(["version_2"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["٣٤"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["2"]).map((hit) => hit.index)).toEqual([1]);
    });

    it("counts the same words as getWordCount in ASCII text", () => {
      const texts = ["It's a dog-eat-dog world, isn't it?", "snake_case and CamelCase", "3.14 is pi"];
      expect(make(texts, { caseSensitive: true }).scores(["dog", "pi"])).toEqual(
        BM25(["It s a dog eat dog world isn t it", "snake_case and CamelCase", "3 14 is pi"], ["dog", "pi"])
      );
    });
  });

  describe("keywords", () => {
    it("searches a number as text and ignores other values", () => {
      const index = make(["released in 2024", "released in 1999"]);
      const year = [2024] as unknown as string[];
      expect(index.search(year).map((hit) => hit.index)).toEqual([0]);
      const odd = [null, undefined, {}, ["2024"], true] as unknown as string[];
      expect(index.search(odd)).toEqual([]);
      expect(index.scores(odd)).toEqual([0, 0]);
    });

    it("throws a TypeError when the keywords are not an array", () => {
      const index = make(documents);
      const bad = "dog" as unknown as string[];
      expect(() => index.search(bad)).toThrow(TypeError);
      expect(() => index.scores(bad)).toThrow(TypeError);
      expect(() => index.search(bad)).toThrow("`keywords` must be an array of strings");
    });
  });

  describe("custom tokenizer", () => {
    it("splits text that is written without spaces", () => {
      // To the default, a run of letters is one word, so a sentence without
      // spaces is a single word. A tokenizer can cut it up, here per character.
      const perCharacter = (text: string): string[] => text.match(/[぀-ヿ一-鿿]|\w+/g) || [];
      const texts = ["犬は速い", "猫は眠る", "the dog"];
      expect(make(texts).search(["犬"])).toEqual([]);
      expect(make(texts).search(["犬は速い"]).map((hit) => hit.index)).toEqual([0]);
      const index = make(texts, { tokenizer: perCharacter });
      expect(index.search(["犬"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["は"]).map((hit) => hit.index)).toEqual([0, 1]);
      expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([2]);
    });

    it("is used for keywords as well as documents", () => {
      const bySemicolon = (text: string): string[] => text.split(";");
      const index = make(["new york;boston", "york;new haven"], { tokenizer: bySemicolon });
      expect(index.search(["new york"]).map((hit) => hit.index)).toEqual([0]);
      expect(index.search(["york;boston"]).map((hit) => hit.index)).toEqual([0, 1]);
    });

    it("receives lowercased text unless caseSensitive is set", () => {
      const seen: string[] = [];
      const spy = (text: string): string[] => {
        seen.push(text);
        return text.split(" ");
      };
      // An index reads the document when it is made, before the keyword.
      make(["A Dog"], { tokenizer: spy }).search(["DOG"]);
      expect(seen).toEqual(readsWhenMade ? ["a dog", "dog"] : ["dog", "a dog"]);
      seen.length = 0;
      make(["A Dog"], { tokenizer: spy, caseSensitive: true }).search(["DOG"]);
      expect(seen).toEqual(readsWhenMade ? ["A Dog", "DOG"] : ["DOG", "A Dog"]);
    });

    it("drops empty words", () => {
      const bySpace = (text: string): string[] => ["", ...text.split(" "), ""];
      const texts = ["dog  cat", "dog"];
      const index = make(texts, { tokenizer: bySpace });
      // Lengths are 2 and 1, as if the tokenizer had returned no empty words.
      expect(index.scores(["dog"])).toEqual(BM25(["dog cat", "dog"], ["dog"]));
      expect(index.scores([" dog "])).toEqual(index.scores(["dog"]));
      expect(index.search([""])).toEqual([]);
      // An empty word is never indexed, so it cannot be found either.
      expect(make(["a  b"], { tokenizer: bySpace }).scores(["  "])).toEqual([0]);
    });

    it("throws a TypeError when the tokenizer returns words that are not strings", () => {
      // An index meets the tokenizer when it is made, the other form at the first search.
      const numbers = ((text: string) => text.split(" ").map(Number)) as unknown as (text: string) => string[];
      expect(() => make(["1 2 3"], { tokenizer: numbers }).search(["1"])).toThrow(TypeError);
      expect(() => make(["1 2 3"], { tokenizer: numbers }).search(["1"])).toThrow(
        "`tokenizer` must return an array of strings"
      );
      const withNull = ((text: string) => [text, null]) as unknown as (text: string) => string[];
      expect(() => make(["dog"], { tokenizer: withNull }).scores(["dog"])).toThrow(TypeError);
    });

    it("throws a TypeError for a tokenizer that is not a function", () => {
      const options = { tokenizer: "words" } as unknown as { tokenizer: (text: string) => string[] };
      expect(() => make(documents, options)).toThrow(TypeError);
      expect(() => make(documents, options)).toThrow("`tokenizer` must be a function");
    });

    it("throws a TypeError when the tokenizer does not return an array", () => {
      const broken = ((text: string) => text) as unknown as (text: string) => string[];
      expect(() => make(documents, { tokenizer: broken }).search(["dog"])).toThrow(TypeError);
      expect(() => make(documents, { tokenizer: broken }).search(["dog"])).toThrow(
        "`tokenizer` must return an array"
      );
      // Without documents the tokenizer is never called until a search does.
      const index = make([], { tokenizer: broken });
      expect(() => index.search(["dog"])).toThrow(TypeError);
    });
  });

  describe("arguments", () => {
    it("throws a TypeError when the documents are not an array", () => {
      expect(() => make("a dog" as unknown as string[])).toThrow(TypeError);
      expect(() => make(undefined as unknown as string[])).toThrow("`documents` must be an array of strings");
    });

    it("uses the defaults of BM25 for k1 and b that are left out", () => {
      const index = make(documents);
      const defaults = index.scores(["quick", "dog"], { k1: 1.2, b: 0.75 });
      expect(index.scores(["quick", "dog"])).toEqual(defaults);
      expect(index.scores(["quick", "dog"], undefined)).toEqual(defaults);
      expect(index.scores(["quick", "dog"], {})).toEqual(defaults);
      expect(index.scores(["quick", "dog"], { k1: undefined, b: undefined })).toEqual(defaults);
    });

    it("accepts the whole valid range of k1 and b", () => {
      const index = make(documents);
      for (const constants of [{ k1: 0 }, { b: 0 }, { b: 1 }, { k1: 1e9 }, { k1: 0, b: 0 }, { k1: 0, b: 1 }]) {
        const scores = index.scores(["quick", "dog"], constants);
        expect(scores.every((score) => Number.isFinite(score) && score >= 0)).toBe(true);
        expect(index.search(["quick", "dog"], constants)).toHaveLength(2);
      }
    });

    it("rejects k1 and b that cannot give a meaningful score", () => {
      const index = make(documents);
      const outOfRange = [{ k1: -1 }, { k1: Infinity }, { k1: NaN }, { b: -0.1 }, { b: 1.1 }, { b: Infinity }, { b: NaN }];
      for (const constants of outOfRange) {
        expect(() => index.scores(["dog"], constants)).toThrow(RangeError);
        expect(() => index.search(["dog"], constants)).toThrow(RangeError);
      }
      const notNumbers = [{ k1: "2" }, { k1: null }, { b: "0.5" }, { b: null }, { b: {} }] as unknown as { k1?: number; b?: number }[];
      for (const constants of notNumbers) {
        expect(() => index.scores(["dog"], constants)).toThrow(TypeError);
        expect(() => index.search(["dog"], constants)).toThrow(TypeError);
      }
      expect(() => index.scores(["dog"], { k1: -1 })).toThrow("`k1` must be a finite number, 0 or more");
      expect(() => index.scores(["dog"], { b: 2 })).toThrow("`b` must be a number from 0 to 1");
    });
  });

  describe("properties", () => {
    // Words of one length, with separators that are not word characters: a
    // keyword can then only occur as a whole word, so BM25 and the index must
    // match exactly the same text.
    const vocabulary = ["able", "bark", "cold", "dawn", "east", "fawn", "gold", "hill", "Iris", "JADE", "kn0t", "l_mb"];
    const word = fc.constantFrom(...vocabulary);
    const separator = fc.constantFrom(" ", ", ", ". ", "\n", " - ", "; ", "!? ");
    const document = fc
      .array(fc.tuple(word, separator), { maxLength: 30 })
      .map((parts) => parts.map(([text, gap]) => text + gap).join(""));
    const corpus = fc.array(document, { maxLength: 15 });
    const query = fc.array(fc.constantFrom(...vocabulary, "zzzz", "none"), { maxLength: 6 });
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

    it("scores() is identical to BM25 when keywords only occur as whole words", () => {
      fc.assert(
        fc.property(corpus, query, constants, (docs, keywords, constant) => {
          const index = make(docs, { caseSensitive: true });
          expect(index.scores(keywords, constant)).toEqual(BM25(docs, keywords, constant));
        }),
        { numRuns: 500 }
      );
    });

    it("ignoring case is the same as lowercasing both sides for BM25", () => {
      fc.assert(
        fc.property(corpus, query, constants, (docs, keywords, constant) => {
          const lowered = docs.map((text) => text.toLowerCase());
          const loweredKeywords = keywords.map((text) => text.toLowerCase());
          expect(make(docs).scores(keywords, constant)).toEqual(
            BM25(lowered, loweredKeywords, constant)
          );
        }),
        { numRuns: 300 }
      );
    });

    it("search() is scores() with the zeros removed, sorted, and cut at the limit", () => {
      fc.assert(
        fc.property(corpus, query, constants, fc.option(fc.nat({ max: 20 }), { nil: undefined }), (docs, keywords, constant, limit) => {
          const index = make(docs);
          const scores = index.scores(keywords, constant);
          const expected: BMHit[] = [];
          scores.forEach((score, position) => {
            if (score > 0) {
              expected.push({ index: position, document: docs[position], score });
            }
          });
          expected.sort((first, second) => second.score - first.score || first.index - second.index);
          const options = limit === undefined ? constant : { ...constant, limit };
          expect(index.search(keywords, options)).toEqual(
            limit === undefined ? expected : expected.slice(0, limit)
          );
        }),
        { numRuns: 300 }
      );
    });

    it("an index can be searched again and again with the same result", () => {
      fc.assert(
        fc.property(corpus, query, query, (docs, firstQuery, secondQuery) => {
          const index = make(docs);
          const before = index.scores(firstQuery);
          index.search(secondQuery);
          index.scores(secondQuery);
          expect(index.scores(firstQuery)).toEqual(before);
        }),
        { numRuns: 200 }
      );
    });
  });
});

describe("BM25: one function, two calls", () => {
  it("returns a searcher when the second argument is missing or is options", () => {
    const optionsList = [undefined, {}, { index: true }, { index: false }, { caseSensitive: true }];
    for (const options of optionsList) {
      const bm25 = BM25(documents, options);
      expect(typeof bm25.search).toBe("function");
      expect(typeof bm25.scores).toBe("function");
      expect(bm25.search(["quick", "dog"]).map((hit) => hit.index)).toEqual([1, 0]);
    }
    expect(BM25(documents).scores(["quick", "dog"])).toEqual(createIndex(documents).scores(["quick", "dog"]));
  });

  it("still scores in one call when the second argument is an array", () => {
    const scores = BM25(documents, ["quick", "dog"]);
    expect(scores).toHaveLength(3);
    expect(scores.every((score) => typeof score === "number")).toBe(true);
    expect(BM25(documents, [])).toEqual([0, 0, 0]);
    const ranked = BM25(documents, ["quick", "dog"], undefined, (first, second) => second.score - first.score);
    expect(ranked.map((entry) => entry.document)).toEqual([documents[1], documents[0], documents[2]]);
    // The older call matches text anywhere and tells case apart; the searcher does neither.
    expect(BM25(["Concatenate"], ["cat"])[0]).toBeGreaterThan(0);
    expect(BM25(["Concatenate"]).scores(["cat"])).toEqual([0]);
    expect(BM25(["A Dog"], ["dog"])).toEqual([0]);
    expect(BM25(["A Dog"]).scores(["dog"])[0]).toBeGreaterThan(0);
  });

  it("throws a TypeError for a second argument that is neither", () => {
    // As before this form existed, these are keywords that are not an array.
    const neither = [
      null,
      "dog",
      5,
      true,
      () => ["dog"],
      new Set(["dog"]),
      new Map([["dog", 1]]),
      new Uint8Array(2),
      new String("dog"),
      new Date(0),
      /dog/,
    ] as unknown as string[][];
    for (const second of neither) {
      expect(() => BM25(documents, second)).toThrow(TypeError);
      expect(() => BM25(documents, second)).toThrow("`keywords` must be an array of strings");
    }
  });

  it("tells options from keywords for values made in another realm", () => {
    // An object or an array from another window, frame or vm context does not
    // share this realm's Object and Array.
    const foreignOptions = vm.runInNewContext("({ index: false, caseSensitive: true })") as BMOptions;
    const foreignKeywords = vm.runInNewContext('["quick", "dog"]') as string[];
    expect(foreignOptions instanceof Object).toBe(false);
    expect(foreignKeywords instanceof Array).toBe(false);
    expect(BM25(documents, foreignOptions).search(["dog"])).toHaveLength(2);
    expect(BM25(documents, foreignOptions).search(["Dog"])).toEqual([]);
    expect(BM25(documents, foreignKeywords)).toEqual(BM25(documents, ["quick", "dog"]));
    expect(BM25(documents, Object.create(null) as BMOptions).search(["dog"])).toHaveLength(2);
  });

  it("names the function that was called in its errors", () => {
    const notDocuments = "a dog" as unknown as string[];
    const notTokenizer = { tokenizer: "words" } as unknown as BMOptions;
    expect(() => BM25(notDocuments)).toThrow("BM25: `documents` must be an array of strings.");
    expect(() => BM25(notDocuments, { index: false })).toThrow("BM25: `documents` must be an array of strings.");
    expect(() => BM25(notDocuments, ["dog"])).toThrow("BM25: `documents` must be an array of strings.");
    expect(() => BM25(documents, notTokenizer)).toThrow("BM25: `tokenizer` must be a function.");
    expect(() => createIndex(notDocuments)).toThrow("createIndex: `documents` must be an array of strings.");
    expect(() => createIndex(documents, notTokenizer)).toThrow("createIndex: `tokenizer` must be a function.");
    expect(() => BM25(documents).search("dog" as unknown as string[])).toThrow(
      "BM25: `keywords` must be an array of strings."
    );
    expect(() => BM25(documents).search(["dog"], { k1: -1 })).toThrow("BM25: `k1` must be a finite number, 0 or more.");
  });

  it("rejects an `index` option that is not a boolean", () => {
    const notBooleans = [0, 1, "false", null, {}] as unknown as boolean[];
    for (const index of notBooleans) {
      expect(() => BM25(documents, { index })).toThrow(TypeError);
      expect(() => BM25(documents, { index })).toThrow("BM25: `index` must be `true` or `false`.");
    }
    expect(BM25(documents, { index: undefined }).search(["dog"])).toHaveLength(2);
  });

  it("createIndex does not look at `index`, which it did not have in 2.1.0", () => {
    const seen: string[] = [];
    const spy = (text: string): string[] => {
      seen.push(text);
      return text.split(" ");
    };
    const values = [false, 0, "no", null] as unknown as boolean[];
    for (const index of values) {
      seen.length = 0;
      const options: BMOptions = { index, tokenizer: spy };
      const made = createIndex(["a dog"], options);
      // The document was read when the index was made, whatever `index` says.
      expect(seen).toEqual(["a dog"]);
      expect(made.search(["dog"])).toHaveLength(1);
    }
  });
});

describe("BM25(documents, { index: false }): when the documents are read", () => {
  const spyOn = (seen: string[]) => (text: string): string[] => {
    seen.push(text);
    return text.match(/\w+/g) || [];
  };

  it("reads them at every search, where an index reads them once when it is made", () => {
    const seen: string[] = [];
    const texts = ["A Dog", "A Cat"];
    const withoutIndex = BM25(texts, { index: false, tokenizer: spyOn(seen) });
    expect(seen).toEqual([]);
    withoutIndex.search(["dog"]);
    expect(seen).toEqual(["dog", "a dog", "a cat"]);
    withoutIndex.scores(["cat"]);
    expect(seen).toEqual(["dog", "a dog", "a cat", "cat", "a dog", "a cat"]);

    seen.length = 0;
    const withIndex = BM25(texts, { tokenizer: spyOn(seen) });
    expect(seen).toEqual(["a dog", "a cat"]);
    withIndex.search(["dog"]);
    withIndex.scores(["cat"]);
    expect(seen).toEqual(["a dog", "a cat", "dog", "cat"]);
  });

  it("does not read them for a search that has no words", () => {
    const seen: string[] = [];
    const withoutIndex = BM25(["A Dog", "A Cat"], { index: false, tokenizer: spyOn(seen) });
    expect(withoutIndex.search([])).toEqual([]);
    expect(withoutIndex.scores(["?!", ""])).toEqual([0, 0]);
    expect(seen).toEqual(["?!", ""]);
  });

  it("meets a broken tokenizer at the first search, an index when it is made", () => {
    // Fails on the document, not on the keyword.
    const broken = ((text: string) => (text === "bad document" ? [1, 2] : text.split(" "))) as unknown as (
      text: string
    ) => string[];
    expect(() => BM25(["a dog", "bad document"], { tokenizer: broken })).toThrow(TypeError);
    const withoutIndex = BM25(["a dog", "bad document"], { index: false, tokenizer: broken });
    expect(() => withoutIndex.search(["dog"])).toThrow("BM25: `tokenizer` must return an array of strings.");
    expect(() => withoutIndex.scores(["dog"])).toThrow(TypeError);
  });

  it("works as before after a tokenizer threw in the middle of the documents", () => {
    let failures = 1;
    const failsOnce = (text: string): string[] => {
      if (text === "a cat" && failures > 0) {
        failures--;
        throw new Error("the tokenizer failed");
      }
      return text.split(" ");
    };
    const texts = ["a dog", "a cat", "a dog and a cat"];
    const withoutIndex = BM25(texts, { index: false, tokenizer: failsOnce });
    expect(() => withoutIndex.search(["dog", "cat"])).toThrow("the tokenizer failed");
    const expected = BM25(texts, { tokenizer: (text) => text.split(" ") });
    expect(withoutIndex.scores(["dog", "cat"])).toEqual(expected.scores(["dog", "cat"]));
    expect(withoutIndex.search(["dog", "cat"])).toEqual(expected.search(["dog", "cat"]));
  });
});

describe("BM25(documents, { index: false }): the same results as with an index", () => {
  // Text with words of several scripts, repeated words, punctuation, empty
  // documents and arbitrary strings, so that the two ways of reading the
  // documents are compared on more than tidy English.
  const word = fc.constantFrom(
    "dog",
    "Dog",
    "DOG",
    "cat",
    "café",
    "café", // the same word, written with a combining accent
    "москва",
    "МОСКВА",
    "犬",
    "version_2",
    "٣٤",
    "c"
  );
  const gap = fc.constantFrom(" ", "  ", ", ", ". ", "\n", "-", "++", "…", "、", "'");
  const noise = fc.string({ unit: "grapheme", maxLength: 6 });
  const piece = fc.oneof({ weight: 4, arbitrary: word }, { weight: 4, arbitrary: gap }, { weight: 1, arbitrary: noise });
  const text = fc.array(piece, { maxLength: 25 }).map((pieces) => pieces.join(""));
  const corpus = fc.array(text, { maxLength: 12 });
  const query = fc.array(fc.oneof({ weight: 3, arbitrary: word }, { weight: 1, arbitrary: text }), { maxLength: 5 });
  const tokenizer = fc.constantFrom<((text: string) => string[]) | undefined>(
    undefined,
    (value) => value.split(" "),
    (value) => Array.from(value),
    (value) => ["", ...(value.match(/\w+/g) || []), ""]
  );
  const searchOptions = fc.record(
    {
      k1: fc.double({ min: 0, max: 5, noNaN: true }),
      b: fc.double({ min: 0, max: 1, noNaN: true }),
      limit: fc.nat({ max: 15 }),
    },
    { requiredKeys: [] }
  );

  it("scores() and search() agree exactly, for every option", () => {
    fc.assert(
      fc.property(corpus, query, fc.boolean(), tokenizer, searchOptions, (docs, keywords, caseSensitive, split, options) => {
        const withIndex = BM25(docs, { caseSensitive, tokenizer: split });
        const withoutIndex = BM25(docs, { caseSensitive, tokenizer: split, index: false });
        const constants = { k1: options.k1, b: options.b };
        expect(withoutIndex.scores(keywords, constants)).toEqual(withIndex.scores(keywords, constants));
        expect(withoutIndex.search(keywords, options)).toEqual(withIndex.search(keywords, options));
        // And again, in the other order, on the same two objects.
        expect(withoutIndex.search(keywords)).toEqual(withIndex.search(keywords));
        expect(withoutIndex.scores(keywords)).toEqual(withIndex.scores(keywords));
      }),
      { numRuns: 1000 }
    );
  });

  it("finds something in at least a third of those cases", () => {
    // Guards the property above against input that never matches.
    const samples = fc.sample(fc.tuple(corpus, query), { numRuns: 300, seed: 42 });
    const withHits = samples.filter(([docs, keywords]) => BM25(docs, { index: false }).search(keywords).length > 0);
    expect(withHits.length).toBeGreaterThanOrEqual(100);
  });
});

describe("BM25(documents): an engine without Unicode patterns", () => {
  it("falls back to ASCII words", () => {
    const RealRegExp = global.RegExp;
    const OldEngineRegExp = function (source: string, flags?: string) {
      if (flags !== undefined && flags.indexOf("u") !== -1) {
        throw new SyntaxError("Invalid flags supplied to RegExp constructor 'u'");
      }
      return new RealRegExp(source, flags);
    } as unknown as RegExpConstructor;
    Object.defineProperty(OldEngineRegExp, "prototype", { value: RealRegExp.prototype });
    const loaded: { module?: typeof import("../BM25") } = {};
    global.RegExp = OldEngineRegExp;
    try {
      jest.isolateModules(() => {
        loaded.module = require("../BM25");
      });
    } finally {
      global.RegExp = RealRegExp;
    }
    const onOldEngine = loaded.module;
    if (onOldEngine === undefined) {
      throw new Error("the module did not load");
    }
    const makers: Make[] = [
      (texts, options) => onOldEngine.BM25(texts, options),
      (texts, options) => onOldEngine.BM25(texts, { ...options, index: false }),
      (texts, options) => onOldEngine.createIndex(texts, options),
    ];
    for (const make of makers) {
      const bm25 = make(["A quick dog", "un café noir"]);
      expect(bm25.search(["DOG"]).map((hit) => hit.index)).toEqual([0]);
      // Without Unicode patterns "café" is the ASCII word "caf".
      expect(bm25.search(["caf"]).map((hit) => hit.index)).toEqual([1]);
      // The fallback is the word of getWordCount: letters, digits and underscores.
      const mixed = make(["Version_2 of 34 files"], { caseSensitive: true });
      expect(mixed.search(["Version_2"])).toHaveLength(1);
      expect(mixed.search(["34"])).toHaveLength(1);
      expect(mixed.search(["Version"])).toEqual([]);
    }
    expect(onOldEngine.BM25(["a dog"], ["dog"])).toEqual(BM25(["a dog"], ["dog"]));
  });
});

/**
 * Tests for `createIndex`: an index of whole words that is built once and
 * searched many times. It uses the scoring formula of `BM25`, so wherever the
 * two match the same words they must give identical scores.
 */
import fc from "fast-check";
import BM25, { BMHit, createIndex } from "../BM25";

const documents = [
  "The quick brown fox jumps over the lazy dog",
  "A quick guide to training your dog",
  "Stock markets fell sharply on Monday",
];

describe("createIndex: searching", () => {
  it("returns the matching documents, best match first", () => {
    const hits = createIndex(documents).search(["quick", "dog"]);
    expect(hits.map((hit) => hit.index)).toEqual([1, 0]);
    expect(hits[0].document).toBe(documents[1]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[1].score).toBeGreaterThan(0);
  });

  it("leaves out documents that contain none of the keywords", () => {
    expect(createIndex(documents).search(["zebra"])).toEqual([]);
    expect(createIndex(documents).search([])).toEqual([]);
    expect(createIndex([]).search(["dog"])).toEqual([]);
  });

  it("gives one score per document with scores()", () => {
    const index = createIndex(documents);
    const scores = index.scores(["quick", "dog"]);
    expect(scores).toHaveLength(3);
    expect(scores[2]).toBe(0);
    const hits = index.search(["quick", "dog"]);
    for (const hit of hits) {
      expect(hit.score).toBe(scores[hit.index]);
    }
    expect(createIndex([]).scores(["dog"])).toEqual([]);
    expect(index.scores([])).toEqual([0, 0, 0]);
  });

  it("gives the scores of BM25 for the same words", () => {
    const index = createIndex(documents, { caseSensitive: true });
    expect(index.scores(["quick", "dog"])).toEqual(BM25(documents, ["quick", "dog"]));
    expect(index.scores(["quick", "dog"], { k1: 1.5, b: 0.5 })).toEqual(
      BM25(documents, ["quick", "dog"], { k1: 1.5, b: 0.5 })
    );
    expect(index.scores(["quick"], { k1: 0, b: 0 })).toEqual(
      BM25(documents, ["quick"], { k1: 0, b: 0 })
    );
  });

  it("uses k1 and b from the search options", () => {
    const index = createIndex(documents);
    const tuned = index.search(["quick", "dog"], { k1: 1.5, b: 0.5 });
    const expected = index.scores(["quick", "dog"], { k1: 1.5, b: 0.5 });
    expect(tuned.map((hit) => hit.score)).toEqual([expected[1], expected[0]]);
    expect(tuned[0].score).not.toBe(index.search(["quick", "dog"])[0].score);
  });

  it("counts a word that occurs several times in a document", () => {
    const repeated = ["dog dog dog cat", "dog cat", "cat"];
    expect(createIndex(repeated).scores(["dog"])).toEqual(BM25(repeated, ["dog"]));
  });

  it("counts a keyword that is given twice, twice", () => {
    const index = createIndex(documents);
    const once = index.scores(["dog"]);
    const twice = index.scores(["dog", "dog"]);
    expect(twice[0]).toBe(once[0] + once[0]);
  });
});

describe("createIndex: whole words", () => {
  it("matches whole words, where BM25 matches inside words", () => {
    const texts = ["concatenate strings", "a cat sat", "a dog"];
    expect(BM25(texts, ["cat"])[0]).toBeGreaterThan(0);
    expect(createIndex(texts).search(["cat"]).map((hit) => hit.index)).toEqual([1]);
  });

  it("splits keywords into words the same way as documents", () => {
    const index = createIndex(documents);
    expect(index.scores(["dog?"])).toEqual(index.scores(["dog"]));
    expect(index.scores(["  dog,  "])).toEqual(index.scores(["dog"]));
    expect(index.scores(["quick dog"])).toEqual(index.scores(["quick", "dog"]));
  });

  it("treats punctuation as a gap between words", () => {
    const index = createIndex(["I write c++ and c", "plain text"]);
    // "c++" is the word "c" to the index. It occurs twice in the first document.
    expect(index.scores(["c++"])).toEqual(index.scores(["c"]));
    expect(index.search(["c++"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["++"])).toEqual([]);
    expect(index.search([""])).toEqual([]);
  });

  it("finds words that are also names of object properties", () => {
    const names = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];
    const index = createIndex(["the constructor of __proto__", "toString and hasOwnProperty", "nothing"]);
    expect(index.search(["constructor"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["__proto__"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["hasOwnProperty"]).map((hit) => hit.index)).toEqual([1]);
    expect(index.search(["valueOf"])).toEqual([]);
    // An index without those words finds nothing and does not throw.
    const plain = createIndex(["a dog", "a cat"]);
    for (const name of names) {
      expect(plain.search([name])).toEqual([]);
      expect(plain.scores([name])).toEqual([0, 0]);
    }
  });
});

describe("createIndex: case", () => {
  it("ignores case by default", () => {
    const index = createIndex(["The DOG barks", "a Dog sleeps", "a cat"]);
    expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0, 1]);
    expect(index.scores(["DOG"])).toEqual(index.scores(["dog"]));
  });

  it("returns the document as it was given, not lowercased", () => {
    expect(createIndex(["The DOG barks"]).search(["dog"])[0].document).toBe("The DOG barks");
  });

  it("tells case apart with caseSensitive", () => {
    const index = createIndex(["The DOG barks", "a Dog sleeps", "a dog"], { caseSensitive: true });
    expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([2]);
    expect(index.search(["DOG"]).map((hit) => hit.index)).toEqual([0]);
  });

  it("ignores case unless caseSensitive is exactly true", () => {
    const options = { caseSensitive: "yes" } as unknown as { caseSensitive: boolean };
    expect(createIndex(["A DOG"], options).search(["dog"])).toHaveLength(1);
    expect(createIndex(["A DOG"], {}).search(["dog"])).toHaveLength(1);
  });
});

describe("createIndex: limit and order", () => {
  const many = ["dog", "dog dog", "cat", "dog cat", "dog"];

  it("returns at most `limit` results", () => {
    const index = createIndex(many);
    const all = index.search(["dog"]);
    expect(all).toHaveLength(4);
    expect(index.search(["dog"], { limit: 2 })).toEqual(all.slice(0, 2));
    expect(index.search(["dog"], { limit: 0 })).toEqual([]);
    expect(index.search(["dog"], { limit: 100 })).toEqual(all);
    expect(index.search(["dog"], { limit: 2.9 })).toEqual(all.slice(0, 2));
    expect(index.search(["dog"], { limit: Infinity })).toEqual(all);
  });

  it("returns everything when no limit is given", () => {
    const index = createIndex(many);
    const all = index.search(["dog"]);
    expect(index.search(["dog"], {})).toEqual(all);
    expect(index.search(["dog"], { limit: undefined })).toEqual(all);
    expect(index.search(["dog"], undefined)).toEqual(all);
  });

  it("rejects a limit that is not a number of results", () => {
    const index = createIndex(many);
    expect(() => index.search(["dog"], { limit: -1 })).toThrow(RangeError);
    expect(() => index.search(["dog"], { limit: NaN })).toThrow(RangeError);
    expect(() => index.search(["dog"], { limit: "2" as unknown as number })).toThrow(TypeError);
    expect(() => index.search(["dog"], { limit: null as unknown as number })).toThrow(TypeError);
    expect(() => index.search(["dog"], { limit: -1 })).toThrow("`limit` must be a number, 0 or more");
  });

  it("keeps the indexed order for documents with equal scores", () => {
    // Documents 0 and 4 are identical, so their scores are equal.
    const hits = createIndex(many).search(["dog"]);
    const first = hits.findIndex((hit) => hit.index === 0);
    const second = hits.findIndex((hit) => hit.index === 4);
    expect(hits[first].score).toBe(hits[second].score);
    expect(first).toBeLessThan(second);
    // The same holds when a later keyword is what finds the earlier document.
    const reversed = createIndex(["cat", "dog", "cat", "dog"]).search(["dog", "cat"]);
    expect(reversed.map((hit) => hit.index)).toEqual([0, 1, 2, 3]);
  });
});

describe("createIndex: a snapshot of the documents", () => {
  it("does not change when the array changes afterwards", () => {
    const texts = ["a dog", "a cat"];
    const index = createIndex(texts);
    texts[0] = "a bird";
    texts.push("another dog");
    expect(index.search(["dog"])).toEqual([{ index: 0, document: "a dog", score: expect.any(Number) }]);
    expect(index.scores(["bird"])).toEqual([0, 0]);
  });

  it("scores documents that are not strings as empty", () => {
    const texts = ["a dog", null, 42, undefined, { text: "dog" }] as unknown as string[];
    const index = createIndex(texts);
    expect(index.scores(["dog"])).toEqual(BM25(texts, ["dog"]));
    expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["42"])).toEqual([]);
  });

  it("never returns NaN, also when no document has a word", () => {
    const wordless = ["", "...", "!? —"];
    const index = createIndex(wordless);
    expect(index.scores(["dog", "!?", "..."])).toEqual([0, 0, 0]);
    expect(index.search(["..."])).toEqual([]);
  });

  it("starts every search from zero", () => {
    // Searches share working memory inside the index. Nothing may be left
    // behind by an earlier search, whichever method ran before.
    const index = createIndex(documents);
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
    const index = createIndex(documents);
    const before = index.scores(["dog"]);
    expect(() => index.search(["dog"], { k1: -1 })).toThrow(RangeError);
    expect(() => index.scores(["dog"], { b: 2 })).toThrow(RangeError);
    expect(() => index.search(["dog"], { limit: -1 })).toThrow(RangeError);
    expect(index.scores(["dog"])).toEqual(before);
  });
});

describe("createIndex: words in any script", () => {
  it("keeps accented words whole", () => {
    const index = createIndex(["un café noir", "the caf is closed", "École normale"]);
    expect(index.search(["café"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["caf"]).map((hit) => hit.index)).toEqual([1]);
    expect(index.search(["école"]).map((hit) => hit.index)).toEqual([2]);
    expect(index.search(["cole"])).toEqual([]);
  });

  it("keeps a letter and its combining mark together", () => {
    // "é" written as "e" followed by U+0301, and Devanagari with vowel signs.
    const index = createIndex(["café noir", "हिन्दी भाषा"]);
    expect(index.search(["café"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["cafe"])).toEqual([]);
    expect(index.search(["हिन्दी"]).map((hit) => hit.index)).toEqual([1]);
  });

  it("ignores case in other scripts too", () => {
    const index = createIndex(["МОСКВА и Санкт-Петербург", "Αθήνα"]);
    expect(index.search(["москва"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["петербург"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["ΑΘΉΝΑ"]).map((hit) => hit.index)).toEqual([1]);
  });

  it("treats punctuation of any script as a gap between words", () => {
    const index = createIndex(["“dog” — cat…", "«chien»", "¿perro?", "犬、猫。"]);
    expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["cat"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["chien"]).map((hit) => hit.index)).toEqual([1]);
    expect(index.search(["perro"]).map((hit) => hit.index)).toEqual([2]);
    expect(index.search(["猫"]).map((hit) => hit.index)).toEqual([3]);
  });

  it("counts digits and underscores as parts of words", () => {
    const index = createIndex(["version_2 of ٣٤ files", "version 2"]);
    expect(index.search(["version_2"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["٣٤"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["2"]).map((hit) => hit.index)).toEqual([1]);
  });

  it("counts the same words as getWordCount in ASCII text", () => {
    const texts = ["It's a dog-eat-dog world, isn't it?", "snake_case and CamelCase", "3.14 is pi"];
    expect(createIndex(texts, { caseSensitive: true }).scores(["dog", "pi"])).toEqual(
      BM25(["It s a dog eat dog world isn t it", "snake_case and CamelCase", "3 14 is pi"], ["dog", "pi"])
    );
  });

  it("falls back to ASCII words on an engine without Unicode patterns", () => {
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
    const index = onOldEngine.createIndex(["A quick dog", "un café noir"]);
    expect(index.search(["DOG"]).map((hit) => hit.index)).toEqual([0]);
    // Without Unicode patterns "café" is the ASCII word "caf".
    expect(index.search(["caf"]).map((hit) => hit.index)).toEqual([1]);
    // The fallback is the word of getWordCount: letters, digits and underscores.
    const mixed = onOldEngine.createIndex(["Version_2 of 34 files"], { caseSensitive: true });
    expect(mixed.search(["Version_2"])).toHaveLength(1);
    expect(mixed.search(["34"])).toHaveLength(1);
    expect(mixed.search(["Version"])).toEqual([]);
    expect(onOldEngine.BM25(["a dog"], ["dog"])).toEqual(BM25(["a dog"], ["dog"]));
  });
});

describe("createIndex: keywords", () => {
  it("searches a number as text and ignores other values", () => {
    const index = createIndex(["released in 2024", "released in 1999"]);
    const year = [2024] as unknown as string[];
    expect(index.search(year).map((hit) => hit.index)).toEqual([0]);
    const odd = [null, undefined, {}, ["2024"], true] as unknown as string[];
    expect(index.search(odd)).toEqual([]);
    expect(index.scores(odd)).toEqual([0, 0]);
  });

  it("throws a TypeError when the keywords are not an array", () => {
    const index = createIndex(documents);
    const bad = "dog" as unknown as string[];
    expect(() => index.search(bad)).toThrow(TypeError);
    expect(() => index.scores(bad)).toThrow(TypeError);
    expect(() => index.search(bad)).toThrow("`keywords` must be an array of strings");
  });
});

describe("createIndex: custom tokenizer", () => {
  it("splits text that is written without spaces", () => {
    // To the default, a run of letters is one word, so a sentence without
    // spaces is a single word. A tokenizer can cut it up, here per character.
    const perCharacter = (text: string): string[] => text.match(/[぀-ヿ一-鿿]|\w+/g) || [];
    const texts = ["犬は速い", "猫は眠る", "the dog"];
    expect(createIndex(texts).search(["犬"])).toEqual([]);
    expect(createIndex(texts).search(["犬は速い"]).map((hit) => hit.index)).toEqual([0]);
    const index = createIndex(texts, { tokenizer: perCharacter });
    expect(index.search(["犬"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["は"]).map((hit) => hit.index)).toEqual([0, 1]);
    expect(index.search(["dog"]).map((hit) => hit.index)).toEqual([2]);
  });

  it("is used for keywords as well as documents", () => {
    const bySemicolon = (text: string): string[] => text.split(";");
    const index = createIndex(["new york;boston", "york;new haven"], { tokenizer: bySemicolon });
    expect(index.search(["new york"]).map((hit) => hit.index)).toEqual([0]);
    expect(index.search(["york;boston"]).map((hit) => hit.index)).toEqual([0, 1]);
  });

  it("receives lowercased text unless caseSensitive is set", () => {
    const seen: string[] = [];
    const spy = (text: string): string[] => {
      seen.push(text);
      return text.split(" ");
    };
    createIndex(["A Dog"], { tokenizer: spy }).search(["DOG"]);
    expect(seen).toEqual(["a dog", "dog"]);
    seen.length = 0;
    createIndex(["A Dog"], { tokenizer: spy, caseSensitive: true }).search(["DOG"]);
    expect(seen).toEqual(["A Dog", "DOG"]);
  });

  it("drops empty words", () => {
    const bySpace = (text: string): string[] => ["", ...text.split(" "), ""];
    const texts = ["dog  cat", "dog"];
    const index = createIndex(texts, { tokenizer: bySpace });
    // Lengths are 2 and 1, as if the tokenizer had returned no empty words.
    expect(index.scores(["dog"])).toEqual(BM25(["dog cat", "dog"], ["dog"]));
    expect(index.scores([" dog "])).toEqual(index.scores(["dog"]));
    expect(index.search([""])).toEqual([]);
    // An empty word is never indexed, so it cannot be found either.
    expect(createIndex(["a  b"], { tokenizer: bySpace }).scores(["  "])).toEqual([0]);
  });

  it("throws a TypeError when the tokenizer returns words that are not strings", () => {
    const numbers = ((text: string) => text.split(" ").map(Number)) as unknown as (text: string) => string[];
    expect(() => createIndex(["1 2 3"], { tokenizer: numbers })).toThrow(TypeError);
    expect(() => createIndex(["1 2 3"], { tokenizer: numbers })).toThrow("`tokenizer` must return an array of strings");
    const withNull = ((text: string) => [text, null]) as unknown as (text: string) => string[];
    expect(() => createIndex(["dog"], { tokenizer: withNull })).toThrow(TypeError);
  });

  it("throws a TypeError for a tokenizer that is not a function", () => {
    const options = { tokenizer: "words" } as unknown as { tokenizer: (text: string) => string[] };
    expect(() => createIndex(documents, options)).toThrow(TypeError);
    expect(() => createIndex(documents, options)).toThrow("`tokenizer` must be a function");
  });

  it("throws a TypeError when the tokenizer does not return an array", () => {
    const broken = ((text: string) => text) as unknown as (text: string) => string[];
    expect(() => createIndex(documents, { tokenizer: broken })).toThrow(TypeError);
    expect(() => createIndex(documents, { tokenizer: broken })).toThrow("`tokenizer` must return an array");
    // An empty index never calls the tokenizer until a search does.
    const index = createIndex([], { tokenizer: broken });
    expect(() => index.search(["dog"])).toThrow(TypeError);
  });
});

describe("createIndex: arguments", () => {
  it("throws a TypeError when the documents are not an array", () => {
    expect(() => createIndex("a dog" as unknown as string[])).toThrow(TypeError);
    expect(() => createIndex(undefined as unknown as string[])).toThrow("`documents` must be an array of strings");
  });

  it("uses the defaults of BM25 for k1 and b that are left out", () => {
    const index = createIndex(documents);
    const defaults = index.scores(["quick", "dog"], { k1: 1.2, b: 0.75 });
    expect(index.scores(["quick", "dog"])).toEqual(defaults);
    expect(index.scores(["quick", "dog"], undefined)).toEqual(defaults);
    expect(index.scores(["quick", "dog"], {})).toEqual(defaults);
    expect(index.scores(["quick", "dog"], { k1: undefined, b: undefined })).toEqual(defaults);
  });

  it("accepts the whole valid range of k1 and b", () => {
    const index = createIndex(documents);
    for (const constants of [{ k1: 0 }, { b: 0 }, { b: 1 }, { k1: 1e9 }, { k1: 0, b: 0 }, { k1: 0, b: 1 }]) {
      const scores = index.scores(["quick", "dog"], constants);
      expect(scores.every((score) => Number.isFinite(score) && score >= 0)).toBe(true);
      expect(index.search(["quick", "dog"], constants)).toHaveLength(2);
    }
  });

  it("rejects k1 and b that cannot give a meaningful score", () => {
    const index = createIndex(documents);
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

describe("createIndex: properties", () => {
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
        const index = createIndex(docs, { caseSensitive: true });
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
        expect(createIndex(docs).scores(keywords, constant)).toEqual(
          BM25(lowered, loweredKeywords, constant)
        );
      }),
      { numRuns: 300 }
    );
  });

  it("search() is scores() with the zeros removed, sorted, and cut at the limit", () => {
    fc.assert(
      fc.property(corpus, query, constants, fc.option(fc.nat({ max: 20 }), { nil: undefined }), (docs, keywords, constant, limit) => {
        const index = createIndex(docs);
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
        const index = createIndex(docs);
        const before = index.scores(firstQuery);
        index.search(secondQuery);
        index.scores(secondQuery);
        expect(index.scores(firstQuery)).toEqual(before);
      }),
      { numRuns: 200 }
    );
  });
});

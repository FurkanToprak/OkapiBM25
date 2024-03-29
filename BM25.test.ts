import BM25, { BMDocument, getTermFrequency, getWordCount } from "./BM25";

describe("Bare bones functionality", () => {
  test("Irrelevant queries should return 0.", () => {
    const documents = ["fee", "fi", "fum"];
    const query = ["qwerty"];
    const results = BM25(documents, query, { k1: 1.3, b: 0.9 }) as number[];
    results.forEach((result: number) => {
      expect(result).toBe(0);
    });
  });

  test("Relevant queries should be greater than 0.", () => {
    const documents = ["fee", "feel", "I'm feeling lucky."];
    const query = ["fee"];
    const results = BM25(documents, query) as number[];
    results.forEach((result: number) => {
      expect(result).toBeGreaterThan(0);
    });
  });

  test("Make sure word count is detected correctly", () => {
    const expectResults = [
      {
        corpus: "Pass the potatoes.",
        expect: 3,
      },
      { corpus: "pass.the.potatoes", expect: 3 },
      { corpus: "pass\nthe\npotatoes.", expect: 3 },
    ];
    expectResults.forEach((expectResult) => {
      const wordCount = getWordCount(expectResult.corpus);
      expect(wordCount).toBe(expectResult.expect);
    });
    const emptyWordCount = getWordCount(null);
    expect(emptyWordCount).toBe(0);
  });

  test("Expect word frequency to be detected correctly", () => {
    // @ts-ignore
    const emptyWordFrequency = getTermFrequency("anything", null);
    expect(emptyWordFrequency).toBe(0);
    const expectResults = [
      {
        corpus: "Pass the pass.",
        term: "pass",
        expect: 1,
      },
      {
        corpus: "Pass the pass.",
        term: "Pass",
        expect: 1,
      },
      {
        corpus: "Pass.pass.pass.",
        term: "pass",
        expect: 2,
      },
    ];
    expectResults.forEach((expectResult) => {
      const result = getTermFrequency(expectResult.term, expectResult.corpus);
      expect(result).toBe(expectResult.expect);
    });
  });
});

describe("Testing fancy sorting mechanism.", () => {
  test("Should sort in ascending order", () => {
    const expectResults = new Map<number, string>();
    expectResults.set(0, "The least relevant");
    expectResults.set(1, "Medium relevant relevant");
    expectResults.set(2, "The most relevant relevant relevant relevant");

    const corpuses = Array.from(expectResults.values());
    const results = BM25(
      corpuses,
      ["relevant"],
      undefined,
      (firstEl, secondEl) => {
        return firstEl.score - secondEl.score;
      }
    ) as BMDocument[];
    results.forEach((result, index) => {
      const expectedDocument = expectResults.get(index);
      expect(expectedDocument).toEqual(result.document);
    });
  });

  test("Should sort in descending order", () => {
    const expectResults = new Map<number, string>();
    expectResults.set(2, "The least relevant");
    expectResults.set(1, "Medium relevant relevant");
    expectResults.set(0, "The most relevant relevant relevant relevant");

    const corpuses = Array.from(expectResults.values());
    const results = BM25(
      corpuses,
      ["relevant"],
      undefined,
      (firstEl, secondEl) => {
        return secondEl.score - firstEl.score;
      }
    ) as BMDocument[];
    results.forEach((result, index) => {
      const expectedDocument = expectResults.get(index);
      expect(expectedDocument).toEqual(result.document);
    });
  });
});

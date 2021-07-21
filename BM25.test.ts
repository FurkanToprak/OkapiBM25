import BM25, { getTermFrequency, getWordCount } from "./BM25";

test("Irrelevant queries should return 0.", () => {
  const documents = ["fee", "fi", "fum"];
  const query = ["qwerty"];
  const results = BM25(documents, query, { k1: 1.3, b: 0.9 });
  results.forEach((result: number) => {
    expect(result).toBe(0);
  });
});

test("Relevant queries should be greater than 0.", () => {
  const documents = ["fee", "feel", "I'm feeling lucky."];
  const query = ["fee"];
  const results = BM25(documents, query);
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
  const emptyWordFrequency = getTermFrequency(null, "anything");
  expect(emptyWordFrequency).toBe(0);
});

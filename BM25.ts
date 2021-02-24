/** Gets word count. */
const getWordCount = (corpus: string) => {
  return ((corpus || "").match(/\w+/g) || []).length;
};

/** Number of occurences of a word in a string. */
const getTermFrequency = (term: string, corpus: string) => {
  return ((corpus || "").match(new RegExp(term, "g")) || []).length;
};

/** Inverse document frequency. */
const getIDF = (term: string, documents: string[]) => {
  // Number of relevant documents.
  const relevantDocuments = documents.filter((document: string) =>
    document.includes(term)
  ).length;
  return Math.log(
    (documents.length - relevantDocuments + 0.5) / (relevantDocuments + 0.5) + 1
  );
};

/** Implementation of Okapi BM25 algorithm.
 *  @param documents: string[]. Collection of documents.
 *  @param keywords: keywords within query.
 *  @param constants: Contains free parameters k1 and b, which are free parameters,
 *  where k1 is within [1.2, 2.0] and b = 0.75, in absence of advanced optimization.
 *  In this implementation, k1 = 1.2.
 */
export function BM25(
  documents: string[],
  keywords: string[],
  constants?: { b?: number; k1?: number }
): number[] {
  const b = constants && constants.b ? constants.b : 0.75;
  const k1 = constants && constants.k1 ? constants.k1 : 1.2;
  const documentLengths = documents.map((document: string) =>
    getWordCount(document)
  );
  const averageDocumentLength =
    documentLengths.reduce((a, b) => a + b, 0) / documents.length;
  const scores = documents.map((document: string, index: number) => {
    const score = keywords
      .map((keyword: string) => {
        const inverseDocumentFrequency = getIDF(keyword, documents);
        const termFrequency = getTermFrequency(keyword, document);
        const documentLength = documentLengths[index];
        return (
          (inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
          (termFrequency +
            k1 * (1 - b + (b * documentLength) / averageDocumentLength))
        );
      })
      .reduce((a: number, b: number) => a + b, 0);
    return score;
  });
  return scores;
}

/** Gets word count. */
export const getWordCount = (corpus: string) => {
  return ((corpus || "").match(/\w+/g) || []).length;
};

/** Number of occurences of a word in a string. */
export const getTermFrequency = (term: string, corpus: string) => {
  return ((corpus || "").match(new RegExp(term, "g")) || []).length;
};

/** Inverse document frequency. */
export const getIDF = (term: string, documents: string[]) => {
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
export default function BM25(
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

/** Sorts a list of object by their BM25 score
 * @param query: the term to search
 * @param objects: an unordered list of object
 * @param key_func: a function that takes an object from the list
 * and returns a string to be evaluated by the BM25 algorithm.
 * If not set, the object is evaluated.
 */
export function bm25sort(query, objects, key_func=null) {
    var keys = key_func ? objects.map(key_func) : objects;
    var scores = BM25(keys, query)
    var container = [];
    for (var i in scores) {
        container.push({
            obj: objects[i],
            score: scores[i],
        })
    }
    container.sort((a, b) => b.score - a.score)
    return container.map(elt => elt.obj)
}

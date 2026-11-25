/** Default value of the free parameter `b`. */
const DEFAULT_B = 0.75;
/** Default value of the free parameter `k1`. */
const DEFAULT_K1 = 1.2;

/** Anything that is not a string is scored as an empty document. */
const toText = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** A free parameter is used when it is a real number, `0` included. Anything else falls back to the default. */
const resolveConstant = (value: unknown, fallback: number): number =>
  typeof value === "number" && !Number.isNaN(value) ? value : fallback;

/** 1 for the ASCII characters that `\w` matches (letters, digits, underscore), 0 for the rest. */
const WORD_CHARACTERS = new Uint8Array(128);
for (let code = 0; code < 128; code++) {
  const isWordCharacter =
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    (code >= 48 && code <= 57) || // 0-9
    code === 95; // _
  WORD_CHARACTERS[code] = isWordCharacter ? 1 : 0;
}

/**
 * Gets word count. A word is a run of ASCII letters, digits and underscores,
 * the same as the regular expression `\w+`.
 */
export const getWordCount = (corpus: string): number => {
  const text = toText(corpus);
  let count = 0;
  let insideWord = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isWordCharacter = code < 128 ? WORD_CHARACTERS[code] : 0;
    // A word starts where a word character follows a character that is not one.
    count += isWordCharacter & ~insideWord;
    insideWord = isWordCharacter;
  }
  return count;
};

/** Counts occurrences of `needle` in `text` that do not overlap. An empty needle occurs zero times. */
const countOccurrences = (needle: string, text: string): number => {
  if (needle.length === 0) {
    return 0;
  }
  let count = 0;
  let position = text.indexOf(needle);
  while (position !== -1) {
    count++;
    position = text.indexOf(needle, position + needle.length);
  }
  return count;
};

/**
 * Number of occurrences of a term in a string.
 *
 * The term is matched literally and case-sensitively, and occurrences do not
 * overlap. It is never interpreted as a regular expression, so terms such as
 * `c++` or `(a+)+$` are safe to pass straight from user input. An empty term
 * occurs zero times.
 */
export const getTermFrequency = (term: string, corpus: string): number =>
  countOccurrences(toText(term), toText(corpus));

/** Inverse document frequency. */
export const getIDF = (term: string, documents: readonly string[]): number => {
  let relevantDocuments = 0;
  for (let i = 0; i < documents.length; i++) {
    if (toText(documents[i]).includes(term)) {
      relevantDocuments++;
    }
  }
  return Math.log(
    (documents.length - relevantDocuments + 0.5) / (relevantDocuments + 0.5) + 1
  );
};

/** Represents a document; useful when sorting results.
 */
export interface BMDocument {
  /** The document that was scored. */
  document: string;
  /** The score that the document receives. */
  score: number;
}

/** Constants that are free parameters used in BM25, specifically when generating inverse document frequency. */
export interface BMConstants {
  /** Free parameter. Is 0.75 by default. `0` turns length normalization off, `1` applies it fully. */
  b?: number;
  /** Free parameter. Is 1.2 by default. Generally in range [1.2, 2.0]. `0` ignores how often a term occurs. */
  k1?: number;
}

/** If returns positive, the sorting results in secondEl coming before firstEl, else, firstEl comes before secondEL  */
export type BMSorter = (firstEl: BMDocument, secondEl: BMDocument) => number;

/** Implementation of Okapi BM25 algorithm.
 *
 * Keywords are matched literally and case-sensitively anywhere in a document.
 *
 *  @param documents: Collection of documents.
 *  @param keywords: query terms.
 *  @param constants: Contains free parameters k1 and b. b=0.75 and k1=1.2 by default.
 *  @param sorter: A function that allows you to sort queries by a given rule. If not provided, returns results corresponding to the original order.
 * If this option is provided, the return type will not be an array of scores but an array of documents with their scores.
 *
 * @example
 * const scores = BM25(["a cat", "a dog"], ["cat"]); // number[]
 * const ranked = BM25(["a cat", "a dog"], ["cat"], undefined, (x, y) => y.score - x.score); // BMDocument[]
 */
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants?: BMConstants
): number[];
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants: BMConstants | undefined,
  sorter: BMSorter
): BMDocument[];
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants?: BMConstants,
  sorter?: BMSorter
): number[] | BMDocument[];
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants?: BMConstants,
  sorter?: BMSorter
): number[] | BMDocument[] {
  if (!Array.isArray(documents)) {
    throw new TypeError("BM25: `documents` must be an array of strings.");
  }
  if (!Array.isArray(keywords)) {
    throw new TypeError("BM25: `keywords` must be an array of strings.");
  }
  const b = resolveConstant(constants ? constants.b : undefined, DEFAULT_B);
  const k1 = resolveConstant(constants ? constants.k1 : undefined, DEFAULT_K1);
  const documentCount = documents.length;

  // Each document is measured once.
  const texts: string[] = new Array(documentCount);
  const documentLengths = new Float64Array(documentCount);
  let totalLength = 0;
  for (let i = 0; i < documentCount; i++) {
    const text = toText(documents[i]);
    const length = getWordCount(text);
    texts[i] = text;
    documentLengths[i] = length;
    totalLength += length;
  }
  const averageDocumentLength =
    documentCount > 0 ? totalLength / documentCount : 0;

  // The part of the denominator that depends only on the document. A
  // collection with no countable words has no length to normalize by, so every
  // document is treated as being of average length.
  const lengthNorms = new Float64Array(documentCount);
  for (let i = 0; i < documentCount; i++) {
    const relativeLength =
      averageDocumentLength > 0
        ? (b * documentLengths[i]) / averageDocumentLength
        : b;
    lengthNorms[i] = k1 * (1 - b + relativeLength);
  }

  const scores: number[] = new Array(documentCount);
  for (let i = 0; i < documentCount; i++) {
    scores[i] = 0;
  }

  // Each keyword reads every document once. That single pass gives both the
  // term frequencies and the number of documents containing the keyword.
  const matchedDocuments = new Uint32Array(documentCount);
  const matchedFrequencies = new Uint32Array(documentCount);
  for (let k = 0; k < keywords.length; k++) {
    // JavaScript callers may pass a number, such as a year. It is searched as text.
    const rawKeyword: unknown = keywords[k];
    const keyword =
      typeof rawKeyword === "number" ? String(rawKeyword) : toText(rawKeyword);
    let matches = 0;
    for (let i = 0; i < documentCount; i++) {
      const termFrequency = countOccurrences(keyword, texts[i]);
      if (termFrequency > 0) {
        matchedDocuments[matches] = i;
        matchedFrequencies[matches] = termFrequency;
        matches++;
      }
    }
    const inverseDocumentFrequency = Math.log(
      (documentCount - matches + 0.5) / (matches + 0.5) + 1
    );
    for (let m = 0; m < matches; m++) {
      const i = matchedDocuments[m];
      const termFrequency = matchedFrequencies[m];
      scores[i] +=
        (inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
        (termFrequency + lengthNorms[i]);
    }
  }

  if (sorter) {
    const scoredDocuments: BMDocument[] = new Array(documentCount);
    for (let i = 0; i < documentCount; i++) {
      scoredDocuments[i] = { score: scores[i], document: documents[i] };
    }
    return scoredDocuments.sort(sorter);
  }
  return scores;
}

export default BM25;

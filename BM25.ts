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

/** Options for {@link createIndex}. */
export interface BMIndexOptions {
  /**
   * Whether `Dog` and `dog` are different words. `false` by default: documents
   * and keywords are lowercased before they are split into words.
   */
  caseSensitive?: boolean;
  /**
   * Splits a text into words. It is called for every document and for every
   * keyword, after lowercasing unless `caseSensitive` is set. Empty words are
   * dropped. By default a word is a run of letters, digits and underscores in
   * any script. Pass a tokenizer for languages that are written without
   * spaces, or to remove common words or endings.
   */
  tokenizer?: (text: string) => string[];
}

/**
 * Options for {@link BMIndex.search}. Unlike `BM25`, an index rejects values
 * that cannot give a meaningful score: `k1` must be a finite number of 0 or
 * more and `b` a number from 0 to 1.
 */
export interface BMSearchOptions extends BMConstants {
  /** Return at most this many results. All matching documents by default. */
  limit?: number;
}

/** A document found by {@link BMIndex.search}. */
export interface BMHit extends BMDocument {
  /** Position of the document in the array given to {@link createIndex}. */
  index: number;
}

/** A searchable index of a fixed set of documents, made by {@link createIndex}. */
export interface BMIndex {
  /**
   * The documents that contain at least one of the keywords, best match first.
   * Documents with equal scores keep the order they were indexed in.
   */
  search(keywords: readonly string[], options?: BMSearchOptions): BMHit[];
  /**
   * One score per document, in the order the documents were indexed in. A
   * document that contains none of the keywords scores `0`.
   */
  scores(keywords: readonly string[], constants?: BMConstants): number[];
}

/** The documents containing a word, and how often each one contains it. */
interface Posting {
  documents: number[];
  frequencies: number[];
}

/** `undefined` when the JavaScript engine does not support the pattern. */
const compilePattern = (source: string, flags: string): RegExp | undefined => {
  try {
    return new RegExp(source, flags);
  } catch (error) {
    return undefined;
  }
};

/**
 * The default definition of a word for an index: a run of letters, marks that
 * combine with letters, digits and underscores, in any script. For ASCII text
 * these are the words that `getWordCount` counts. The pattern is compiled at
 * run time because its syntax is newer than the ES2015 this file is built
 * for; engines from before 2018 fall back to ASCII words.
 */
const WORDS = compilePattern("[\\p{L}\\p{M}\\p{N}_]+", "gu") || /\w+/g;

/** Reads an option that has to be a number from 0 to `max`. `undefined` gives the default. */
const readNumber = (
  value: unknown,
  fallback: number,
  max: number,
  rule: string
): number => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number") {
    throw new TypeError("BM25 index: " + rule);
  }
  // Written so that NaN fails it too.
  if (!(value >= 0 && value <= max)) {
    throw new RangeError("BM25 index: " + rule);
  }
  return value;
};

/**
 * Reads the documents once and builds an index of their words, so that each
 * later search looks words up instead of reading the text again. Worth it when
 * the same documents are searched many times.
 *
 * Matching differs from {@link BM25}: the index matches whole words. `cat`
 * finds the word `cat` and not `concatenate`, and case is ignored unless
 * `caseSensitive` is set. Keywords are split into words the same way as the
 * documents, so the keyword `dog?` finds the word `dog`. The scoring formula
 * and the defaults of `k1` and `b` are those of {@link BM25}.
 *
 * The index is a snapshot. Changing the array afterwards does not change it.
 *
 * @throws TypeError when `documents` is not an array, when `tokenizer` is not
 * a function, or when it returns something other than an array of strings.
 * `search` and `scores` throw a TypeError when `keywords` is not an array or
 * an option is not a number, and a RangeError when an option is out of range.
 *
 * @example
 * const index = createIndex(["A quick dog", "A lazy cat", "Stock markets"]);
 * index.search(["Dog?"]); // [{ index: 0, document: "A quick dog", score: 0.93... }]
 * index.scores(["dog"]); // [0.93..., 0, 0]
 */
export function createIndex(
  documents: readonly string[],
  options?: BMIndexOptions
): BMIndex {
  if (!Array.isArray(documents)) {
    throw new TypeError(
      "createIndex: `documents` must be an array of strings."
    );
  }
  const caseSensitive = options ? options.caseSensitive === true : false;
  const tokenizer = options ? options.tokenizer : undefined;
  if (tokenizer !== undefined && typeof tokenizer !== "function") {
    throw new TypeError("createIndex: `tokenizer` must be a function.");
  }

  /** The words of a text. A custom tokenizer may return empty words; callers skip those. */
  const toWords = (text: string): string[] => {
    const prepared = caseSensitive ? text : text.toLowerCase();
    if (tokenizer === undefined) {
      return prepared.match(WORDS) || [];
    }
    const words: unknown = tokenizer(prepared);
    if (!Array.isArray(words)) {
      throw new TypeError(
        "createIndex: `tokenizer` must return an array of strings."
      );
    }
    for (let w = 0; w < words.length; w++) {
      if (typeof words[w] !== "string") {
        throw new TypeError(
          "createIndex: `tokenizer` must return an array of strings."
        );
      }
    }
    return words;
  };

  const documentCount = documents.length;
  const originals = documents.slice();
  // A Map, not an object, so that words such as `constructor` are ordinary keys.
  const postings = new Map<string, Posting>();
  const documentLengths = new Float64Array(documentCount);
  let totalLength = 0;
  for (let i = 0; i < documentCount; i++) {
    const words = toWords(toText(documents[i]));
    let length = 0;
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      if (word.length === 0) {
        continue;
      }
      length++;
      const posting = postings.get(word);
      if (posting === undefined) {
        postings.set(word, { documents: [i], frequencies: [1] });
        continue;
      }
      // Documents are added in order, so a repeat of the word within this
      // document is always at the end of the list.
      const last = posting.documents.length - 1;
      if (posting.documents[last] === i) {
        posting.frequencies[last]++;
      } else {
        posting.documents.push(i);
        posting.frequencies.push(1);
      }
    }
    documentLengths[i] = length;
    totalLength += length;
  }
  // Only read once a word has been found, and then at least one document has
  // a word, so it is a positive number wherever it is used.
  const averageDocumentLength = totalLength / documentCount;

  // Working memory shared by all searches, so that a search costs time in
  // proportion to the documents it finds and not to the size of the index.
  // Both are all zeros between searches: `clear` undoes what `collect` wrote.
  const totals = new Float64Array(documentCount);
  const isMatched = new Uint8Array(documentCount);

  /**
   * Adds the score of every document that contains a keyword into `totals`
   * and returns the positions of those documents, in the order they were
   * first found. The caller reads `totals` and then calls `clear`.
   */
  const collect = (
    keywords: readonly string[],
    constants: BMConstants | undefined
  ): number[] => {
    if (!Array.isArray(keywords)) {
      throw new TypeError(
        "BM25 index: `keywords` must be an array of strings."
      );
    }
    const b = readNumber(
      constants ? constants.b : undefined,
      DEFAULT_B,
      1,
      "`b` must be a number from 0 to 1."
    );
    const k1 = readNumber(
      constants ? constants.k1 : undefined,
      DEFAULT_K1,
      Number.MAX_VALUE,
      "`k1` must be a finite number, 0 or more."
    );
    // Every keyword is split into words before any score is added. The
    // tokenizer is the caller's code, and none of it runs, and nothing can
    // throw, while `totals` holds a search in progress.
    const words: string[] = [];
    for (let k = 0; k < keywords.length; k++) {
      // As in BM25, a number is searched as text and other values match nothing.
      const rawKeyword: unknown = keywords[k];
      const keywordWords = toWords(
        typeof rawKeyword === "number" ? String(rawKeyword) : toText(rawKeyword)
      );
      for (let w = 0; w < keywordWords.length; w++) {
        words.push(keywordWords[w]);
      }
    }

    const matched: number[] = [];
    for (let w = 0; w < words.length; w++) {
      const posting = postings.get(words[w]);
      if (posting === undefined) {
        continue;
      }
      const matches = posting.documents.length;
      // The arithmetic below is the same, operation for operation, as in
      // BM25, so both give identical scores when they match the same words.
      const inverseDocumentFrequency = Math.log(
        (documentCount - matches + 0.5) / (matches + 0.5) + 1
      );
      for (let m = 0; m < matches; m++) {
        const i = posting.documents[m];
        const termFrequency = posting.frequencies[m];
        const relativeLength =
          (b * documentLengths[i]) / averageDocumentLength;
        const lengthNorm = k1 * (1 - b + relativeLength);
        totals[i] +=
          (inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
          (termFrequency + lengthNorm);
        if (isMatched[i] === 0) {
          isMatched[i] = 1;
          matched.push(i);
        }
      }
    }
    return matched;
  };

  const clear = (matched: number[]): void => {
    for (let m = 0; m < matched.length; m++) {
      totals[matched[m]] = 0;
      isMatched[matched[m]] = 0;
    }
  };

  return {
    search(keywords, options) {
      const limit = readNumber(
        options ? options.limit : undefined,
        Infinity,
        Infinity,
        "`limit` must be a number, 0 or more."
      );
      const matched = collect(keywords, options);
      // The position breaks ties, so the order never depends on the engine's sort.
      matched.sort(
        (first, second) => totals[second] - totals[first] || first - second
      );
      const hits: BMHit[] = new Array(
        Math.floor(Math.min(matched.length, limit))
      );
      for (let m = 0; m < hits.length; m++) {
        const i = matched[m];
        hits[m] = { index: i, document: originals[i], score: totals[i] };
      }
      clear(matched);
      return hits;
    },
    scores(keywords, constants) {
      const matched = collect(keywords, constants);
      const scores: number[] = new Array(documentCount);
      for (let i = 0; i < documentCount; i++) {
        scores[i] = 0;
      }
      for (let m = 0; m < matched.length; m++) {
        scores[matched[m]] = totals[matched[m]];
      }
      clear(matched);
      return scores;
    },
  };
}

export default BM25;

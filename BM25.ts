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

/**
 * Scores the documents against the keywords in one call. Keywords are matched
 * literally and case-sensitively anywhere in a document.
 *
 * @deprecated Use `BM25(documents).scores(keywords)`, or
 * `BM25(documents, { index: false }).scores(keywords)` for documents that are
 * searched only once. That form matches whole words and ignores case, so
 * scores can differ from this one. This form keeps working in every 2.x
 * release.
 *
 * @param documents Collection of documents.
 * @param keywords Query terms.
 * @param constants Free parameters `k1` and `b`. `b` is 0.75 and `k1` is 1.2 by default.
 */
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants?: BMConstants
): number[];
/**
 * Scores the documents against the keywords in one call and returns them
 * sorted, each with its score.
 *
 * @deprecated Use `BM25(documents).search(keywords)`, which returns the
 * matching documents sorted by score. That form matches whole words and
 * ignores case, so scores can differ from this one. This form keeps working in
 * every 2.x release.
 *
 * @param sorter Sorts the results, like the function given to `Array.prototype.sort()`.
 */
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants: BMConstants | undefined,
  sorter: BMSorter
): BMDocument[];
// The form to use. Its overload comes after the two above so that a second
// argument typed `any` still selects the older call and gives `number[]`, as
// it did before this form existed.
/**
 * Okapi BM25 over a set of documents. Give it the documents and get back an
 * object that searches them: `search` returns the matching documents, best
 * first, and `scores` returns one score per document.
 *
 * By default the documents are read once, here, and an index of their words
 * is built, so that every search afterwards is a lookup. That is worth it when
 * the same documents are searched more than once. Pass `{ index: false }` for
 * documents that are searched once: nothing is built, and each search reads
 * the documents instead. The results are the same either way, to the last
 * digit.
 *
 * Whole words are matched: `cat` finds the word `cat` and not `concatenate`.
 * Case is ignored unless `caseSensitive` is set. Keywords are split into words
 * the same way as the documents, so the keyword `dog?` finds the word `dog`.
 *
 * The documents are a snapshot. Changing the array afterwards changes nothing.
 *
 * @throws TypeError when `documents` is not an array, when `index` is not a
 * boolean, when `tokenizer` is not a function, or when it returns something
 * other than an array of strings. A tokenizer that fails is met where the
 * documents are read: here with an index, at the first search without one.
 * `search` and `scores` throw a TypeError when `keywords` is not an array or
 * an option is not a number, and a RangeError when an option is out of range.
 *
 * @example
 * const bm25 = BM25(["A quick dog", "A lazy cat", "Stock markets"]);
 * bm25.search(["Dog?"]); // [{ index: 0, document: "A quick dog", score: 0.93... }]
 * bm25.scores(["dog"]); // [0.93..., 0, 0]
 */
export function BM25(
  documents: readonly string[],
  options?: BMOptions
): BMSearcher;
/**
 * @deprecated Use `BM25(documents).search(keywords)` or
 * `BM25(documents).scores(keywords)`.
 */
export function BM25(
  documents: readonly string[],
  keywords: readonly string[],
  constants?: BMConstants,
  sorter?: BMSorter
): number[] | BMDocument[];
export function BM25(
  documents: readonly string[],
  keywordsOrOptions?: readonly string[] | BMOptions,
  constants?: BMConstants,
  sorter?: BMSorter
): BMSearcher | number[] | BMDocument[] {
  // Nothing in second place, or an ordinary object of options, asks for a
  // searcher. Everything else is the older call, which scores in one go and
  // throws below unless it was given an array of keywords. The tag is read
  // this way so that a Set, a Map or a typed array is not taken for options,
  // and so that an object made in another window or realm is.
  if (
    keywordsOrOptions === undefined ||
    Object.prototype.toString.call(keywordsOrOptions) === "[object Object]"
  ) {
    return createSearcher(
      documents,
      keywordsOrOptions as BMOptions | undefined,
      "BM25",
      false
    );
  }
  const keywords = keywordsOrOptions as readonly string[];
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

/** Options for {@link BM25}. */
export interface BMOptions {
  /**
   * Whether to build an index of the words of the documents. `true` by
   * default. With `false` nothing is built and every search reads the
   * documents: slower per search, but with no work up front and no index
   * kept in memory. The results are identical. Use `false` for documents
   * that are searched only once.
   */
  index?: boolean;
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
   *
   * It has to return the same words every time it is given the same text.
   * With an index it reads each document once; without one, once per search.
   */
  tokenizer?: (text: string) => string[];
}

/**
 * Options for {@link BMSearcher.search}. Values that cannot give a meaningful
 * score are rejected: `k1` must be a finite number of 0 or more and `b` a
 * number from 0 to 1.
 */
export interface BMSearchOptions extends BMConstants {
  /** Return at most this many results. All matching documents by default. */
  limit?: number;
}

/** A document found by {@link BMSearcher.search}. */
export interface BMHit extends BMDocument {
  /** Position of the document in the array given to {@link BM25}. */
  index: number;
}

/** Searches a fixed set of documents. Made by {@link BM25}. */
export interface BMSearcher {
  /**
   * The documents that contain at least one of the keywords, best match first.
   * Documents with equal scores keep the order they were given in.
   */
  search(keywords: readonly string[], options?: BMSearchOptions): BMHit[];
  /**
   * One score per document, in the order the documents were given in. A
   * document that contains none of the keywords scores `0`.
   */
  scores(keywords: readonly string[], constants?: BMConstants): number[];
}

/**
 * The options of {@link createIndex}: those of {@link BM25} without `index`.
 *
 * @deprecated Use {@link BMOptions} with {@link BM25}.
 */
export type BMIndexOptions = Omit<BMOptions, "index">;

/** @deprecated Renamed to {@link BMSearcher}. */
export type BMIndex = BMSearcher;

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

/** What a search needs to know about the documents. */
interface Reading {
  /** For each word that was looked for, where it was found. */
  postings: Map<string, Posting>;
  /** The number of words in each document. */
  documentLengths: Float64Array;
  averageDocumentLength: number;
}

/**
 * The default definition of a word for a search: a run of letters, marks that
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
    throw new TypeError("BM25: " + rule);
  }
  // Written so that NaN fails it too.
  if (!(value >= 0 && value <= max)) {
    throw new RangeError("BM25: " + rule);
  }
  return value;
};

/**
 * What `BM25(documents, options)` returns. `caller` is the name of the
 * exported function, for error messages. With `alwaysIndex` the `index`
 * option is not looked at, as in 2.1.0, when it did not exist.
 */
const createSearcher = (
  documents: readonly string[],
  options: BMOptions | undefined,
  caller: string,
  alwaysIndex: boolean
): BMSearcher => {
  if (!Array.isArray(documents)) {
    throw new TypeError(
      caller + ": `documents` must be an array of strings."
    );
  }
  const useIndex = alwaysIndex || !options ? undefined : options.index;
  if (useIndex !== undefined && typeof useIndex !== "boolean") {
    throw new TypeError(caller + ": `index` must be `true` or `false`.");
  }
  const caseSensitive = options ? options.caseSensitive === true : false;
  const tokenizer = options ? options.tokenizer : undefined;
  if (tokenizer !== undefined && typeof tokenizer !== "function") {
    throw new TypeError(caller + ": `tokenizer` must be a function.");
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
        caller + ": `tokenizer` must return an array of strings."
      );
    }
    for (let w = 0; w < words.length; w++) {
      if (typeof words[w] !== "string") {
        throw new TypeError(
          caller + ": `tokenizer` must return an array of strings."
        );
      }
    }
    return words;
  };

  const documentCount = documents.length;
  const originals = documents.slice();

  /**
   * Reads every document once: counts its words and notes in `postings` which
   * documents contain which words. With `everyWord`, each word that is met
   * gets an entry, which makes `postings` an index. Without it, only the words
   * that already have an entry are noted, which is a search without an index.
   * Both ways run this one loop, so they cannot count differently.
   */
  const read = (postings: Map<string, Posting>, everyWord: boolean): Reading => {
    const documentLengths = new Float64Array(documentCount);
    let totalLength = 0;
    for (let i = 0; i < documentCount; i++) {
      const words = toWords(toText(originals[i]));
      let length = 0;
      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        if (word.length === 0) {
          continue;
        }
        length++;
        const posting = postings.get(word);
        if (posting === undefined) {
          if (everyWord) {
            postings.set(word, { documents: [i], frequencies: [1] });
          }
          continue;
        }
        // Documents are read in order, so a repeat of the word within this
        // document is always at the end of the list. A list that is still
        // empty has no end, and takes the other branch.
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
    // The average is only used once a word has been found, and then at least
    // one document has a word, so it is a positive number wherever it is used.
    return {
      postings,
      documentLengths,
      averageDocumentLength: totalLength / documentCount,
    };
  };

  // A Map, not an object, so that words such as `constructor` are ordinary keys.
  const index =
    useIndex === false ? undefined : read(new Map<string, Posting>(), true);

  // Working memory shared by all searches, so that a search of an index costs
  // time in proportion to the documents it finds and not to their number.
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
      throw new TypeError("BM25: `keywords` must be an array of strings.");
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
    // Every keyword is split into words, and without an index every document
    // is read, before any score is added. The tokenizer is the caller's code,
    // and none of it runs, and nothing can throw, while `totals` holds a
    // search in progress.
    const words: string[] = [];
    for (let k = 0; k < keywords.length; k++) {
      // A number is searched as text and other values match nothing.
      const rawKeyword: unknown = keywords[k];
      const keywordWords = toWords(
        typeof rawKeyword === "number" ? String(rawKeyword) : toText(rawKeyword)
      );
      for (let w = 0; w < keywordWords.length; w++) {
        words.push(keywordWords[w]);
      }
    }

    const matched: number[] = [];
    let reading = index;
    if (reading === undefined) {
      if (words.length === 0) {
        return matched;
      }
      // No index: read the documents now, noting only the words of this search.
      const wanted = new Map<string, Posting>();
      for (let w = 0; w < words.length; w++) {
        wanted.set(words[w], { documents: [], frequencies: [] });
      }
      reading = read(wanted, false);
    }
    const { postings, documentLengths, averageDocumentLength } = reading;

    for (let w = 0; w < words.length; w++) {
      const posting = postings.get(words[w]);
      if (posting === undefined) {
        continue;
      }
      const matches = posting.documents.length;
      // The arithmetic below is the same, operation for operation, as in the
      // older call of BM25 with keywords, so both give identical scores when
      // they match the same words.
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
};

/**
 * The name that `BM25(documents, options)` had in 2.1.0. It always builds an
 * index.
 *
 * @deprecated Use `BM25(documents, options)`. It takes the same arguments and
 * returns the same object. This name keeps working in every 2.x release.
 */
export function createIndex(
  documents: readonly string[],
  options?: BMIndexOptions
): BMIndex {
  return createSearcher(documents, options, "createIndex", true);
}

export default BM25;

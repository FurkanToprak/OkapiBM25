# okapibm25

[![npm version](https://img.shields.io/npm/v/okapibm25)](https://www.npmjs.com/package/okapibm25)
[![CI](https://github.com/FurkanToprak/OkapiBM25/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/FurkanToprak/OkapiBM25/actions/workflows/ci.yml)
[![NPM Downloads](https://img.shields.io/npm/dy/okapibm25)](https://www.npmjs.com/package/okapibm25)
[![Types included](https://img.shields.io/npm/types/okapibm25)](https://www.npmjs.com/package/okapibm25)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/okapibm25?activeTab=dependencies)
[![License](https://img.shields.io/npm/l/okapibm25)](LICENSE.md)

![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg)
![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg)

Score and rank documents against search keywords with [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25), the ranking function behind most full-text search engines.

- One function. Give it your documents and your keywords, get a score per document.
- An optional index for searching the same documents many times: about half a millisecond per search on 10,000 documents.
- No dependencies, 5 kB gzipped.
- Written in TypeScript, types included.
- Runs on Node 12 and later, and in browsers through a bundler.
- Safe with text typed by users: keywords are matched as plain text.

```sh
npm install okapibm25
```

## Quick start

```ts
import { BM25 } from "okapibm25";

const documents = [
  "The quick brown fox jumps over the lazy dog",
  "A quick guide to training your dog",
  "Stock markets fell sharply on Monday",
];

const scores = BM25(documents, ["quick", "dog"]);
// [0.860, 0.958, 0]
```

You get one score per document, in the order of `documents`. A higher score means a better match, and a document that contains none of the keywords scores `0`. The second document wins here because both contain the keywords once and it is shorter.

Every one of these gives you the same function:

```ts
import { BM25 } from "okapibm25"; // TypeScript, bundlers, Node ES modules
import BM25 from "okapibm25"; // TypeScript and bundlers
const { BM25 } = require("okapibm25"); // CommonJS
```

## Used by
- [LlamaIndex](https://www.llamaindex.ai)
- [LibreChat](https://www.librechat.ai)
- [Illuma](https://illuma.cx)
- [Observee](https://www.observee.com/)

## Usage

### Ranked results

Pass a sorter as the fourth argument to get the documents back with their scores, sorted. It works like the function you give to [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).

```ts
const ranked = BM25(documents, ["quick", "dog"], undefined, (a, b) => b.score - a.score);
// [
//   { document: "A quick guide to training your dog", score: 0.958 },
//   { document: "The quick brown fox jumps over the lazy dog", score: 0.860 },
//   { document: "Stock markets fell sharply on Monday", score: 0 },
// ]
```

The sorter receives both the document and its score, so you can sort by score, alphabetically, or by any rule of your own.

With a sorter the return type is `{ document: string; score: number }[]`, and without one it is `number[]`. TypeScript knows which one you get, so no cast is needed.

### Tuning `k1` and `b`

```ts
BM25(documents, ["quick", "dog"], { k1: 1.5, b: 0.5 });
// [0.880, 0.953, 0]
```

- `k1` sets how much it counts when a keyword occurs many times in a document. The default is `1.2`. With `k1: 0` a keyword counts the same whether it occurs once or twenty times.
- `b` sets how much long documents are penalised. The default is `0.75`. With `b: 0` document length is ignored, and with `b: 1` it counts fully.

### Searching for what a user typed

Matching is exact, so `"Quick"` does not match `"quick"` and `"dog?"` does not match `"dog"`. To search for text from a search box, lowercase both sides and take the words out of the text:

```ts
const toKeywords = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

const lowered = documents.map((document) => document.toLowerCase());
const scores = BM25(lowered, toKeywords("Quick dog?")); // the keywords are ["quick", "dog"]

const best = scores
  .map((score, index) => ({ document: documents[index], score }))
  .filter((hit) => hit.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);
```

The scores line up with `documents` by position, which is how the example gets back to the original text. Common words such as "the" and "is" are keywords like any other. If they drown out the words that matter, remove them from the keywords.

An index, described next, does the lowercasing and the splitting for you.

### Searching the same documents many times

`BM25` reads all the text on every call. When the documents stay the same between searches, build an index once and search that instead:

```ts
import { createIndex } from "okapibm25";

const index = createIndex(documents);

const hits = index.search(["Quick", "dog?"]);
// [
//   { index: 1, document: "A quick guide to training your dog", score: 0.958 },
//   { index: 0, document: "The quick brown fox jumps over the lazy dog", score: 0.860 },
// ]

const top = index.search(["quick", "dog"], { limit: 1, k1: 1.5, b: 0.5 });
const all = index.scores(["quick", "dog"]);
// [0.860, 0.958, 0]
```

- `search` returns the documents that contain at least one keyword, best match first. `index` is the position of the document in the array you gave to `createIndex`.
- `scores` returns one score per document, like `BM25`.
- The index is a snapshot of the documents. To add or change documents, build a new one.

The index uses the same formula as `BM25`, but it matches differently:

| | `BM25` | `createIndex` |
|---|---|---|
| What a keyword matches | Its exact text, anywhere: `"cat"` matches `"concatenate"` | Whole words: `"cat"` matches only the word `cat` |
| Case | `"Dog"` and `"dog"` differ | Ignored, unless you pass `{ caseSensitive: true }` |
| Punctuation in a keyword | Part of the text to find: `"c++"` finds `c++` | A gap between words: `"dog?"` finds `dog`, and `"c++"` finds the word `c` |
| A keyword of several words | Found as a phrase: `"quick guide"` | Each word counts on its own |
| What a word is | For document length only: a run of `a-z`, `A-Z`, `0-9` and `_` | A run of letters, digits and `_` in any script: `café` and `москва` are words |
| `k1` and `b` out of range | Used as given | Rejected with an error |

The formula is the same. With `{ caseSensitive: true }`, on English text, `index.scores` returns exactly the numbers `BM25` returns for keywords that are single words and occur only as whole words.

Languages that are written without spaces, such as Japanese and Chinese, need your own function to split a text into words. It is used for the documents and for the keywords:

```ts
const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

const japaneseIndex = createIndex(["犬は速い", "猫は眠る"], {
  tokenizer: (text) =>
    Array.from(segmenter.segment(text))
      .filter((part) => part.isWordLike)
      .map((part) => part.segment),
});
japaneseIndex.search(["犬"]); // finds the first document
```

The same option is the place to remove common words or to cut endings off words.

## How matching works

This is how `BM25` matches. An index made with `createIndex` matches whole words instead; see the table above.

- A keyword matches wherever its exact text appears in a document, including inside a longer word: `"cat"` matches `"concatenate"`.
- Matching is case-sensitive. To ignore case, lowercase your documents and your keywords before calling `BM25`.
- Keywords are plain text, never regular expressions. `"c++"`, `"(draft)"` and anything else a user types into a search box are safe to pass in as they are.
- Document length is the number of words, where a word is a run of the characters `a-z`, `A-Z`, `0-9` and `_`.
- `k1` and `b` default to `1.2` and `0.75`. Both accept `0`.

## API

### `BM25(documents, keywords, constants?, sorter?)`

| Argument | Type | Meaning |
|---|---|---|
| `documents` | `readonly string[]` | The texts to score. A document that is not a string scores `0`. |
| `keywords` | `readonly string[]` | The words or phrases to look for. Each one adds to the score. |
| `constants` | `{ k1?: number; b?: number }` | Optional. Defaults: `k1` is `1.2`, `b` is `0.75`. |
| `sorter` | `(a: BMDocument, b: BMDocument) => number` | Optional. When given, the result is sorted with it. |

Returns `number[]` without a sorter and `BMDocument[]`, which is `{ document: string; score: number }[]`, with one. Throws a `TypeError` when `documents` or `keywords` is not an array.

### `createIndex(documents, options?)`

Returns an index of the documents with two methods.

| Option | Type | Meaning |
|---|---|---|
| `caseSensitive` | `boolean` | Optional. `false` by default: case is ignored. |
| `tokenizer` | `(text: string) => string[]` | Optional. Splits a text into words. It receives lowercased text unless `caseSensitive` is set. Empty words are dropped. |

| Method | Returns |
|---|---|
| `index.search(keywords, options?)` | `BMHit[]`, which is `{ index: number; document: string; score: number }[]`: the documents that contain a keyword, best match first. Equal scores keep the order of the documents. |
| `index.scores(keywords, constants?)` | `number[]`: one score per document, in the order of the documents. |

The options of `search` are `k1`, `b` and `limit`, the largest number of results to return. `scores` takes `k1` and `b`.

An index is stricter than `BM25` about what it is given:

- `k1` must be a finite number of 0 or more, `b` a number from 0 to 1, and `limit` a number of 0 or more. A value of another type throws a `TypeError`, and a number out of range a `RangeError`. Leave an option out to get its default.
- `documents` and `keywords` must be arrays, and a tokenizer must return an array of strings. Anything else throws a `TypeError`.

### Helpers

The parts of the calculation are exported too:

```ts
import { getWordCount, getTermFrequency, getIDF } from "okapibm25";

getWordCount("The quick brown fox"); // 4, the number of words
getTermFrequency("an", "banana bandana"); // 4, how often the text occurs
getIDF("dog", documents); // 0.470, higher when fewer documents contain the keyword
```

### Types

`BMDocument`, `BMConstants`, `BMSorter`, `BMIndex`, `BMIndexOptions`, `BMSearchOptions` and `BMHit` are exported for your own signatures.

## Upgrading from 1.x

Version 2 matches keywords as plain text. Version 1 treated them as regular expressions, so a keyword such as `dog?` or `c\+\+` gives different scores now. For ordinary keywords the scores are identical to 1.4.1. The cases to check are listed under [Upgrading from 1.x](CHANGELOG.md#upgrading-from-1x) in the changelog.

## Speed and limits

`BM25` builds no index. Each call reads every document once per keyword, plus once to count its words, so the time grows with the amount of text times the number of keywords. It is about twice as fast as version 1.4.1.

`createIndex` reads the documents once. After that a search looks its keywords up and never reads the text again.

Measured on an Apple M3 laptop with 10,000 documents of about 200 words each and five keywords:

| | Time |
|---|---|
| One `BM25` call | 60 ms |
| `createIndex`, once | 210 ms |
| `index.search`, best 10 results | 0.5 ms |

So `BM25` is the better fit when the documents are different on every call, or when you search them only a few times. The index pays for itself from the fourth search of the same documents. A search takes longer when its keywords are in many documents, because every matching document is ranked. Run `npm run bench` in a clone of the repository to measure it yourself.

Everything is kept in memory and nothing is saved to disk. For collections of hundreds of megabytes, use a search engine built for that.

## Compatibility

- **Node:** 12 and later. The build is ES2015 and CommonJS, and it is loaded on Node 12, 14, 16, 18 and 20 and fully tested on Node 22 and 24 for every change.
- **TypeScript:** 4.0 and later, with CommonJS, `nodenext` and `bundler` module settings.
- **Bundlers:** esbuild, webpack and vite are tested for every change.
- **Stable scores:** the tests compare every change against the published 1.4.1 build, so scores do not move by accident. The changes made on purpose are listed in [CHANGELOG.md](CHANGELOG.md).

## Security

Keywords are never run as regular expressions, so text from users cannot throw or freeze the process. Releases are published from GitHub Actions with a [provenance attestation](https://docs.npmjs.com/generating-provenance-statements), which links the package on npm to the commit it was built from. To report a security problem, see [SECURITY.md](SECURITY.md).

## Contributing

Pull requests are welcome. If this isn't your area, open an issue and I'll get to it. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to run the checks and how a release is made.

## License

MIT. See [LICENSE.md](LICENSE.md).

## Sponsorship
Consider donating $5 to https://www.unicef.org/ if this has been useful to you.

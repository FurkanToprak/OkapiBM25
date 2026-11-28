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

Search and rank documents with [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25), the ranking function behind most full-text search engines.

- One call. `BM25(documents)` gives you `search`, for the best matches, and `scores`, for a score per document.
- Fast when you search the same documents again: an index is built once, and a search of 10,000 documents takes about half a millisecond. Turn the index off for documents you search only once.
- Matches whole words in any script and ignores case, so text from a search box can go in as it was typed.
- No dependencies, 5 kB gzipped.
- Written in TypeScript, types included.
- Runs on Node 12 and later, and in browsers through a bundler.
- Safe with text typed by users: keywords are never run as regular expressions.

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

const bm25 = BM25(documents);

const hits = bm25.search(["quick", "dog"]);
// [
//   { index: 1, document: "A quick guide to training your dog", score: 0.958 },
//   { index: 0, document: "The quick brown fox jumps over the lazy dog", score: 0.860 },
// ]

const scores = bm25.scores(["quick", "dog"]);
// [0.860, 0.958, 0]
```

- `search` returns the documents that contain a keyword, best match first. `index` is the position of the document in your array.
- `scores` returns one score per document, in the order of your array. A document that contains none of the keywords scores `0`.

A higher score means a better match. The second document wins here because both contain the keywords once and it is shorter.

`BM25(documents)` reads the documents once and builds an index of their words. Keep the object and search it as often as you like: each search is a lookup in the index.

### Documents that you search only once

When the documents are different every time, an index is work that is thrown away. Turn it off:

```ts
const top = BM25(documents, { index: false }).search(["quick", "dog"], { limit: 1 });
// [{ index: 1, document: "A quick guide to training your dog", score: 0.958 }]
```

Nothing is built, and each search reads the documents instead. The results are the same as with an index, to the last digit. Only the time differs: see [With or without an index](#with-or-without-an-index).

### Importing

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

### Searching for what a user typed

Pass the text as it is. A keyword is split into words the same way as the documents, so case and punctuation do not matter:

```ts
const typed = bm25.search(["Quick dog?"], { limit: 10 });
// the same two hits as for ["quick", "dog"]
```

`limit` is the largest number of results you want. Without it you get every document that matches.

### Tuning `k1` and `b`

```ts
const tuned = bm25.scores(["quick", "dog"], { k1: 1.5, b: 0.5 });
// [0.880, 0.953, 0]
```

- `k1` sets how much it counts when a keyword occurs many times in a document. The default is `1.2`. With `k1: 0` a keyword counts the same whether it occurs once or twenty times.
- `b` sets how much long documents are penalised. The default is `0.75`. With `b: 0` document length is ignored, and with `b: 1` it counts fully.

`search` takes the same two options next to `limit`.

### With or without an index

Both give the same results. The difference is when the work is done.

| | With an index (default) | `{ index: false }` |
|---|---|---|
| `BM25(documents)` | Reads every document and builds the index | Does nothing yet |
| Each search | Looks the keywords up | Reads every document |
| Memory | Keeps the index | Keeps no index |

Measured on an Apple M3 laptop with 10,000 documents of about 200 words each and five keywords:

| | Time |
|---|---|
| `BM25(documents)`, once | 200 ms |
| A search of the index, best 10 results | 0.5 ms |
| A search with `{ index: false }` | 110 ms |

So turn the index off when you search a set of documents once. From the second search of the same documents, the index is faster.

### Common words

Words such as "the" and "is" are keywords like any other. If they drown out the words that matter, remove them with a `tokenizer`, the function that splits a text into words. It is used for the documents and for the keywords:

```ts
const common = new Set(["the", "a", "is", "to", "your"]);

const withoutCommonWords = BM25(documents, {
  tokenizer: (text) => (text.match(/[\p{L}\p{M}\p{N}_]+/gu) ?? []).filter((word) => !common.has(word)),
});
```

The pattern in this example is the one used when you pass no tokenizer.

The same option is the place to cut endings off words, so that `dogs` finds `dog`.

### Languages written without spaces

Japanese and Chinese, among others, need a function that knows where their words end:

```ts
const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

const japanese = BM25(["犬は速い", "猫は眠る"], {
  tokenizer: (text) =>
    Array.from(segmenter.segment(text))
      .filter((part) => part.isWordLike)
      .map((part) => part.segment),
});
japanese.search(["犬"]); // finds the first document
```

### Documents that change

The object is a snapshot of the documents you gave it. Changing your array afterwards changes nothing. To add, remove or change documents, call `BM25` again.

## How matching works

- **Whole words.** `cat` finds the word `cat`, not `concatenate`.
- **A word** is a run of letters, digits and `_` in any script. `café`, `москва` and `version_2` are words.
- **Case is ignored**, unless you pass `{ caseSensitive: true }`.
- **Punctuation is a gap between words.** `dog?` finds `dog`, and `c++` finds the word `c`.
- **A keyword of several words** counts each word on its own: `"quick dog"` is the same as `"quick", "dog"`. Phrases are not matched as phrases.
- **A keyword given twice** counts twice.
- **Keywords are plain text**, never regular expressions. Anything a user types is safe to pass in.

## API

### `BM25(documents, options?)`

`documents` is an array of strings. A document that is not a string scores `0`.

| Option | Type | Meaning |
|---|---|---|
| `index` | `boolean` | Optional. `true` by default: build an index of the words. With `false`, every search reads the documents. The results are the same. |
| `caseSensitive` | `boolean` | Optional. `false` by default: case is ignored. |
| `tokenizer` | `(text: string) => string[]` | Optional. Splits a text into words. It receives lowercased text unless `caseSensitive` is set. Empty words are dropped. It must return the same words every time it is given the same text. |

It returns an object with two methods:

| Method | Returns |
|---|---|
| `search(keywords, options?)` | `BMHit[]`, which is `{ index: number; document: string; score: number }[]`: the documents that contain a keyword, best match first. Equal scores keep the order of the documents. |
| `scores(keywords, constants?)` | `number[]`: one score per document, in the order of the documents. |

The options of `search` are `k1`, `b` and `limit`. `scores` takes `k1` and `b`.

Values that cannot give a meaningful result are rejected:

- `k1` must be a finite number of 0 or more, `b` a number from 0 to 1, and `limit` a number of 0 or more. A value of another type throws a `TypeError`, and a number out of range a `RangeError`. Leave an option out to get its default.
- `documents` and `keywords` must be arrays, `index` a boolean, and a tokenizer a function that returns an array of strings. Anything else throws a `TypeError`. A tokenizer that fails on a document is noticed when the documents are read: in `BM25(documents)` with an index, at the first search without one.

### Types

`BMSearcher` is what `BM25(documents)` returns. `BMOptions`, `BMSearchOptions`, `BMConstants` and `BMHit` are exported for your own signatures.

## The older call

Before 2.2 the package was called with documents and keywords together:

```ts
const olderScores = BM25(documents, ["quick", "dog"]);
// [0.860, 0.958, 0]

const olderRanked = BM25(documents, ["quick", "dog"], { k1: 1.2, b: 0.75 }, (a, b) => b.score - a.score);
// [{ document: "A quick guide to training your dog", score: 0.958 }, ...]
```

This call is deprecated. It works in every 2.x release exactly as it did, and its scores have not changed, so there is no hurry. Editors show it struck through.

To move over:

| Older call | Now |
|---|---|
| `BM25(documents, keywords)` | `BM25(documents, { index: false }).scores(keywords)` |
| `BM25(documents, keywords, { k1, b })` | `BM25(documents, { index: false }).scores(keywords, { k1, b })` |
| `BM25(documents, keywords, undefined, sorter)` | `BM25(documents, { index: false }).search(keywords)` |
| `createIndex(documents, options)` from 2.1 | `BM25(documents, options)` |

Leave `{ index: false }` out if you search the same documents more than once.

`search` is not the older call with a sorter under another name. It leaves out the documents that match nothing, it always puts the best match first, and each result carries its `index`. For every document, or for an order of your own, sort what `scores` returns.

The two do not match the same way, so scores can change when you move:

| | Older call | `BM25(documents)` |
|---|---|---|
| What a keyword matches | Its exact text, anywhere: `"cat"` matches `"concatenate"` | Whole words: `"cat"` matches only the word `cat` |
| Case | `"Dog"` and `"dog"` differ | Ignored, unless you pass `{ caseSensitive: true }` |
| Punctuation in a keyword | Part of the text to find: `"c++"` finds `c++` | A gap between words: `"dog?"` finds `dog` |
| A keyword of several words | Found as a phrase: `"quick guide"` | Each word counts on its own |
| What a word is, for document length | A run of `a-z`, `A-Z`, `0-9` and `_` | A run of letters, digits and `_` in any script |
| `k1` and `b` out of range | Used as given | Rejected with an error |
| Sorted results | Every document, in the order of your sorter | The documents that match, best first |

The formula is the same. With `{ caseSensitive: true }`, on English text, `scores` returns exactly the numbers the older call returns for keywords that are single words and occur only as whole words.

If you need text matched anywhere, phrases, or keywords such as `c++`, stay with the older call.

The parts of the older call's calculation are exported too:

```ts
import { getWordCount, getTermFrequency, getIDF } from "okapibm25";

getWordCount("The quick brown fox"); // 4, the number of words
getTermFrequency("an", "banana bandana"); // 4, how often the text occurs
getIDF("dog", documents); // 0.470, higher when fewer documents contain the keyword
```

`BMDocument` and `BMSorter` are the types of the older call. `BMIndex` and `BMIndexOptions` are the types of `createIndex`: in 2.2, `BMIndex` is another name for `BMSearcher`, and `BMIndexOptions` is `BMOptions` without `index`, because `createIndex` always builds an index.

## Upgrading from 1.x

Version 2 matches keywords as plain text. Version 1 treated them as regular expressions, so a keyword such as `dog?` or `c\+\+` gives different scores now. For ordinary keywords the scores of the older call are identical to 1.4.1. The cases to check are listed under [Upgrading from 1.x](CHANGELOG.md#upgrading-from-1x) in the changelog.

## Speed and limits

With an index, `BM25(documents)` reads every document once. After that a search looks its keywords up and never reads the text again, so it takes time in proportion to the documents it finds. A search takes longer when its keywords are in many documents, because every matching document is ranked.

Without an index, every search reads every document, so it takes time in proportion to the amount of text. The figures are under [With or without an index](#with-or-without-an-index). Run `npm run bench` in a clone of the repository to measure it yourself.

The index takes memory. In one measurement, the index of 14 MB of text took about 45 MB.

The older call takes 55 ms on the same documents. It is faster than a search without an index because it looks for text and does not split the documents into words. It is about twice as fast as version 1.4.1.

Everything is kept in memory and nothing is saved to disk. For collections of hundreds of megabytes, use a search engine built for that.

## Compatibility

- **Node:** 12 and later. The build is ES2015 and CommonJS, and it is loaded on Node 12, 14, 16, 18 and 20 and fully tested on Node 22 and 24 for every change.
- **TypeScript:** 4.0 and later. Tested with the CommonJS module setting from 4.0, `nodenext` from 4.7 and `bundler` from 5.0, the versions that introduced them.
- **Bundlers:** esbuild, webpack and vite are tested for every change.
- **Stable scores:** the tests compare the older call against the published 1.4.1 build for every change, so its scores do not move by accident. The changes made on purpose are listed in [CHANGELOG.md](CHANGELOG.md).

## Security

Keywords are never run as regular expressions, so text from users cannot throw or freeze the process. Releases are published from GitHub Actions with a [provenance attestation](https://docs.npmjs.com/generating-provenance-statements), which links the package on npm to the commit it was built from. To report a security problem, see [SECURITY.md](SECURITY.md).

## Contributing

Pull requests are welcome. If this isn't your area, open an issue and I'll get to it. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to run the checks and how a release is made.

## License

MIT. See [LICENSE.md](LICENSE.md).

## Sponsorship
Consider donating $5 to https://www.unicef.org/ if this has been useful to you.

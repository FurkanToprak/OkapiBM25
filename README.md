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
- No dependencies, 2 kB gzipped.
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

## How matching works
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

### Helpers

The parts of the calculation are exported too:

```ts
import { getWordCount, getTermFrequency, getIDF } from "okapibm25";

getWordCount("The quick brown fox"); // 4, the number of words
getTermFrequency("an", "banana bandana"); // 4, how often the text occurs
getIDF("dog", documents); // 0.470, higher when fewer documents contain the keyword
```

### Types

`BMDocument`, `BMConstants` and `BMSorter` are exported for your own signatures.

## Upgrading from 1.x

Version 2 matches keywords as plain text. Version 1 treated them as regular expressions, so a keyword such as `dog?` or `c\+\+` gives different scores now. For ordinary keywords the scores are identical to 1.4.1. The cases to check are listed under [Upgrading from 1.x](CHANGELOG.md#upgrading-from-1x) in the changelog.

## Speed and limits

`BM25` builds no index. Each call reads every document once per keyword, plus once to count its words, so the time grows with the amount of text times the number of keywords. As a rough guide, 20,000 documents (10 MB of text) with four keywords take about 85 ms on an Apple M3 laptop. Version 2 is about twice as fast as 1.4.1; run `npm run bench` in a clone of the repository to measure it yourself.

That is fast enough to rank a few thousand documents on every keystroke, or the candidates another search step has already found. For collections of hundreds of megabytes, or many searches per second over the same text, use a search engine that keeps an index.

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

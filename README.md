# okapibm25

![NPM Downloads](https://img.shields.io/npm/dy/okapibm25)
![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg)
![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg)


A strongly typed, tested, and profiled implementation of the [Okapi BM25 algorithm](https://en.wikipedia.org/wiki/Okapi_BM25). Just provide your documents to search, query keywords, and (optionally) your weights (*b* and *k1*). 

Install the [NPM package!](https://www.npmjs.com/package/okapibm25)

## Used by
- https://www.llamaindex.ai
- https://www.librechat.ai
- https://illuma.cx
- https://www.observee.com/

## Installation
```sh
npm install okapibm25 --save
```
## Usage
```ts
import { BM25 } from "okapibm25";

const documents = [
  "place",
  "documents",
  "here",
  "Each test document will be searched with the keywords specified below.",
];
const query = ["keywords", "of", "your", "query"];
// A numerical scoring will be returned, one score per document.
const result = BM25(documents, query, { k1: 1.3, b: 0.9 });
console.log(result);
```
Every one of these gives you the same function:
```ts
import { BM25 } from "okapibm25"; // TypeScript, bundlers, Node ES modules
import BM25 from "okapibm25"; // TypeScript and bundlers
const { BM25 } = require("okapibm25"); // CommonJS
```
### Sorting
You can sort your documents. [This works very similar to JavaScript's Array.prototype.sort() function.](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)

Here is an example of how to sort in descending order (by score).
```ts
const results = BM25(
  documents,
  ["relevant"],
  undefined,
  (firstEl, secondEl) => {
    return secondEl.score - firstEl.score;
  }
);
```
I've purposely given a schema that lets you sort results by more than just score; you could also sort alphabetically (or by how many times the word 'unicorn' is mentioned, for all I care!) by comparing the documents as well. You can also even ignore scores while sorting!

*Important:* Note that enabling sorting changes the return type from `number[]` to `{ document: string; score: number; }[]`. TypeScript knows which one you get, so no cast is needed.

### How matching works
- A keyword matches wherever its exact text appears in a document, including inside a longer word: `"cat"` matches `"concatenate"`.
- Matching is case-sensitive. To ignore case, lowercase your documents and your keywords before calling `BM25`.
- Keywords are plain text, never regular expressions. `"c++"`, `"(draft)"` and anything else a user types into a search box are safe to pass in as they are.
- Document length is the number of words, where a word is a run of the characters `a-z`, `A-Z`, `0-9` and `_`.
- `k1` and `b` default to `1.2` and `0.75`. Both accept `0`: `k1: 0` ignores how often a keyword occurs and `b: 0` ignores document length.

### Speed
Each call reads every document once per keyword, plus once to measure it. On the benchmark in this repository it runs about twice as fast as version 1.4.1. Run it yourself with `npm run bench`.

## License
Under `license.md`

## Contributing
Submit a Pull Request if you have a useful feature that you'd like to add. If you're too lazy or this isn't your area of expertise, open an issue and I'll get to it.

Working on the package needs Node 22.18 or later. The published package itself runs on Node 12 and later.

```sh
npm install
npm run check   # typecheck, tests, build, package check
npm test        # tests only; coverage must stay at 100%
npm run bench   # speed compared with version 1.4.1

npm run test:compat      # the packed package on TypeScript 4.0 to current, esbuild, webpack and vite
npm run test:downstream  # the largest dependent package gives the same results as with the published version
```

The tests in `tests/regression` compare the code against the published 1.4.1 build, so a change in scores shows up as a failure. If you change scores on purpose, add the case to `tests/behavior_changes.test.ts` and note it in `CHANGELOG.md`. A change to the exported types or names fails the check until you update the snapshot with `npm run test:api -- --update`.

To report a security problem, see `SECURITY.md`.

## Sponsorship
Consider donating $5 to https://www.unicef.org/ if this has been useful to you.

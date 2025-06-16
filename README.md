# @furkantoprak/bm25

![NPM Downloads](https://img.shields.io/npm/dy/okapibm25)
![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg)
![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg)


A strongly typed, well-tested implementation of the Okapi BM25 algorithm. Just provide your documents to search, query keywords, and (optionally) your weights (*b* and *k1*).

## Installation
Check out the [NPM package.](https://www.npmjs.com/package/okapibm25)
```
npm install okapibm25 --save
```
## Usage
```
import { BM25 } from "okapibm25";

const documents = [
  "place",
  "documents",
  "here",
  "Each test document will be searched with the keywords specified below.",
];
const query = ["keywords", "of", "your", "query."];
// A numerical scoring will be returned.
const result = BM25(documents, query, { k1: 1.3, b: 0.9 }) as number[];
console.log(result);

```
### Sorting
A recent update allows you to sort your documents. [This works very similar to JavaScript's Array.prototype.sort() function.](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)

Here is an example of how to sort in descending order (by score).
```
 const results = BM25(
      corpuses,
      ["relevant"],
      undefined,
      (firstEl, secondEl) => {
        return secondEl.score - firstEl.score;
      }
    ) as BMDocument[];
```
I've purposely given a schema that lets you sort results by more than just score; you could also sort alphabetically (or by how many times the word 'unicorn' is mentioned, for all I care!) by comparing the documents as well. You can also even ignore scores while sorting!

*Important:* Note that enabling sorting changes the return type from `number[]` to `{ document: string; score: number; }[]`

## What's this?
An implementation of OkapiBM25 (AKA BM25), a [bag-of-words](https://en.wikipedia.org/wiki/Bag-of-words_model) information retrieval algorithm. [Read up on it here](https://en.wikipedia.org/wiki/Okapi_BM25).

## License
Under `license.md`

## Contributing
Submit a Pull Request if you have a useful feature that you'd like to add. If you're too lazy or this isn't your area of expertise, open an issue and I'll get to it.

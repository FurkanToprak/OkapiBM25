# @furkantoprak/bm25

![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg)
![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg)


There was no satisfactory implementation of the Okapi BM25 algorithm, so here is one to use. Just provide your documentations, query keywords, and (optionally) your weights (*b* and *k1*).

## Installation
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
const result = BM25(documents, query, { k1: 1.3, b: 0.9 });
console.log(result);

```
## License
Under `license.md`

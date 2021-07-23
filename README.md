# @furkantoprak/bm25

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
```typescript
import { BM25, bm25sort } from "okapibm25";

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

var objects = [
    {"id": "foo", "description": "Lorem ipsum dolor sit amet"},
    {"id": "bar", "description": "Abra Kadabra Abra"},
    {"id": "baz", "description": "Abra Alakazam"},
]
var sorted = bm25sort(["Abra"], objects, obj => obj.description)
console.log(sorted);

/* [
 *    {"id": "bar", "description": "Abra Kadabra Abra"},
 *    {"id": "baz", "description": "Abra Alakazam"},
 *    {"id": "foo", "description": "Lorem ipsum dolor sit amet"},
 * ]
```
## License
Under `license.md`

## Contributing
Submit a Pull Request if you have a useful feature that you'd like to add. If you're too lazy or this isn't your area of expertise, open an issue and I'll get to it.

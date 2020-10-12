# @furkantoprak/bm25
There was no satisfactory implementation of the Okapi BM25 algorithm, so here is one to use. Just provide your documentations, query keywords, and (optionally) your weights (*b* and *k1*).

## Installation
```
npm install okapibm25 --save
```
## Usage
```
const documents = ["place", "documents", "here", "Each test document will be searched with the keywords specified below."];
const query = ["keywords", "of", "your", "query."]
// A numerical scoring will be returned.
const BM25(documents, query, { k1: 1.3, b: 0.9 });
```
## License
Under `license.md`

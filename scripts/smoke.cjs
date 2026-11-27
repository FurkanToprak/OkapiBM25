// Loads the build and scores a few documents. Written in old-style JavaScript
// so it runs on every Node version the build is meant to support.
var assert = require("assert");
var pkg = require("../dist/BM25.js");

var documents = ["a cat", "a dog", "c++ and c#", ""];
var scores = pkg.BM25(documents, ["cat", "c++"]);
assert.strictEqual(pkg.default, pkg.BM25);
assert.strictEqual(scores.length, 4);
assert.ok(scores[0] > 0);
assert.strictEqual(scores[1], 0);
assert.ok(scores[2] > 0);
assert.strictEqual(scores[3], 0);

var ranked = pkg.default(documents, ["dog"], { k1: 0, b: 0 }, function (first, second) {
  return second.score - first.score;
});
assert.strictEqual(ranked[0].document, "a dog");
assert.strictEqual(pkg.getWordCount("one two"), 2);
assert.strictEqual(pkg.getTermFrequency("a", "banana"), 3);
assert.ok(pkg.getIDF("a", documents) > 0);

var index = pkg.createIndex(documents);
var hits = index.search(["CAT", "dog?"], { limit: 5 });
assert.strictEqual(hits.length, 2);
assert.strictEqual(hits[0].index, 0);
assert.strictEqual(hits[1].document, "a dog");
assert.ok(hits[0].score > 0);
assert.deepStrictEqual(index.scores(["cat"]), pkg.BM25(documents, ["cat"]));

console.log("Build works on Node " + process.version);

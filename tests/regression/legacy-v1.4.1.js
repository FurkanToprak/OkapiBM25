// FROZEN REFERENCE. Do not edit.
//
// This is dist/BM25.js exactly as published in okapibm25@1.4.1 on npm, minus
// the source map comment. The regression tests compare the current
// implementation against it, and the benchmark uses it as the baseline.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIDF = exports.getTermFrequency = exports.getWordCount = void 0;
/** Gets word count. */
var getWordCount = function (corpus) {
    return ((corpus || "").match(/\w+/g) || []).length;
};
exports.getWordCount = getWordCount;
/** Number of occurences of a word in a string. */
var getTermFrequency = function (term, corpus) {
    return ((corpus || "").match(new RegExp(term, "g")) || []).length;
};
exports.getTermFrequency = getTermFrequency;
/** Inverse document frequency. */
var getIDF = function (term, documents) {
    // Number of relevant documents.
    var relevantDocuments = documents.filter(function (document) {
        return document.includes(term);
    }).length;
    return Math.log((documents.length - relevantDocuments + 0.5) / (relevantDocuments + 0.5) + 1);
};
exports.getIDF = getIDF;
/** Implementation of Okapi BM25 algorithm.
 *  @param documents: Collection of documents.
 *  @param keywords: query terms.
 *  @param constants: Contains free parameters k1 and b. b=0.75 and k1=1.2 by default.
 *  @param sort: A function that allows you to sort queries by a given rule. If not provided, returns results corresponding to the original order.
 * If this option is provided, the return type will not be an array of scores but an array of documents with their scores.
 */
function BM25(documents, keywords, constants, sorter) {
    var b = constants && constants.b ? constants.b : 0.75;
    var k1 = constants && constants.k1 ? constants.k1 : 1.2;
    var documentLengths = documents.map(function (document) {
        return exports.getWordCount(document);
    });
    var averageDocumentLength = documentLengths.reduce(function (a, b) { return a + b; }, 0) / documents.length;
    var idfByKeyword = keywords.reduce(function (obj, keyword) {
        obj.set(keyword, exports.getIDF(keyword, documents));
        return obj;
    }, new Map());
    var scores = documents.map(function (document, index) {
        var score = keywords
            .map(function (keyword) {
            var inverseDocumentFrequency = idfByKeyword.get(keyword);
            var termFrequency = exports.getTermFrequency(keyword, document);
            var documentLength = documentLengths[index];
            return ((inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
                (termFrequency +
                    k1 * (1 - b + (b * documentLength) / averageDocumentLength)));
        })
            .reduce(function (a, b) { return a + b; }, 0);
        if (sorter) {
            return { score: score, document: document };
        }
        return score;
    });
    // sort the results
    if (sorter) {
        return scores.sort(sorter);
    }
    return scores;
}
exports.default = BM25;

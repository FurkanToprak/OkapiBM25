"use strict";
exports.__esModule = true;
exports.BM25 = void 0;
/** Gets word count. */
var getWordCount = function (corpus) {
    return ((corpus || "").match(/\w+/g) || []).length;
};
/** Number of occurences of a word in a string. */
var getTermFrequency = function (term, corpus) {
    return ((corpus || "").match(new RegExp(term, "g")) || []).length;
};
/** Inverse document frequency. */
var getIDF = function (term, documents) {
    // Number of relevant documents.
    var relevantDocuments = documents.filter(function (document) {
        return document.includes(term);
    }).length;
    return Math.log((documents.length - relevantDocuments + 0.5) / (relevantDocuments + 0.5) + 1);
};
/** Implementation of Okapi BM25 algorithm.
 *  @param documents: string[]. Collection of documents.
 *  @param keywords: keywords within query.
 *  @param constants: Contains free parameters k1 and b, which are free parameters,
 *  where k1 is within [1.2, 2.0] and b = 0.75, in absence of advanced optimization.
 *  In this implementation, k1 = 1.2.
 */
function BM25(documents, keywords, constants) {
    var b = constants && constants.b ? constants.b : 0.75;
    var k1 = constants && constants.k1 ? constants.k1 : 1.2;
    var documentLengths = documents.map(function (document) {
        return getWordCount(document);
    });
    var averageDocumentLength = documentLengths.reduce(function (a, b) { return a + b; }, 0) / documents.length;
    var scores = documents.map(function (document, index) {
        var score = keywords
            .map(function (keyword) {
            var inverseDocumentFrequency = getIDF(keyword, documents);
            var termFrequency = getTermFrequency(keyword, document);
            var documentLength = documentLengths[index];
            return ((inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
                (termFrequency +
                    k1 * (1 - b + (b * documentLength) / averageDocumentLength)));
        })
            .reduce(function (a, b) { return a + b; }, 0);
        return score;
    });
    return scores;
}
exports.BM25 = BM25;

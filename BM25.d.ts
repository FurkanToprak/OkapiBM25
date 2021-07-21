/** Implementation of Okapi BM25 algorithm.
 *  @param documents: string[]. Collection of documents.
 *  @param keywords: keywords within query.
 *  @param constants: Contains free parameters k1 and b, which are free parameters,
 *  where k1 is within [1.2, 2.0] and b = 0.75, in absence of advanced optimization.
 *  In this implementation, k1 = 1.2.
 */
export declare function BM25(documents: string[], keywords: string[], constants?: {
    b?: number;
    k1?: number;
}): number[];

import { bm25Idf } from "../src/idf";

describe("BM25 IDF", () => {
    test("rare term > common term", () => {
        const N = 1000; // total number of docs

        const idfRare = bm25Idf(N, 1, "plain"); // term appears in 1 doc, positive IDF
        const idfCommon = bm25Idf(N, 900, "plain"); // term appears in 900 docs, negative IDF
        
        expect(idfRare).toBeGreaterThan(idfCommon); // Rare > Common
    });

    test("nonnegative policy clamps", () => {
        const N = 100, df = 80; // df means 80/100 docs
        expect(bm25Idf(N, df, "nonnegative")).toBeGreaterThanOrEqual(0); // IDF values should never be < 0
    });

    test("plus stays positive", () => {
        const N = 100, df=80;
        expect(bm25Idf(N, df, "plus1")).toBeGreaterThan(0); // Add +1 to the log expression so it gives a positive result
    });
});
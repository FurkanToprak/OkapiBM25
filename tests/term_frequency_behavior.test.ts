import BM25 from "../BM25";

describe("Term Frequency scaling in BM25", () => {
    test("when k1 > 0, higher term frequency gives higher scores", () => {
        const docs = ["dog", "dog dog", "dog dog dog dog"];
        const q = ["dog"];
        /* Run BM25 with default parameters (k1 > 0 = TF in play)
        Return an array of scores*/
        const scores = BM25(docs, q, { k1: 1.2, b: 0.75 }) as number[];

        // TF active, score("dog dog") > score("dog")
        expect(scores[0]).toBeLessThan(scores[1]);

        // TF active, score("dog dog dog dog") > score("dog dog")
        expect(scores[1]).toBeLessThan(scores[2]);
    });

    test("when k1 = 0 and b = 0, term frequency does not change the score", () => {
        const d1 = "dog cat cat cat cat cat cat cat cat cat"; // tf = 1
        const d3 = "dog dog dog cat cat cat cat cat cat cat"; // tf = 3
        const d9 = "dog dog dog dog dog dog dog dog dog cat"; // tf = 9
        const docs = [d1, d3, d9];
        const q = ["dog"];

        /* Run BM25 with with k = 0 and b = 0, the document either contains 'x' or not.
        Return an array of scores, if it contains 'x', its score should be the same still*/
        const scores = BM25(docs, q, { k1: 0, b: 0.75 }) as number[];

        // All three have 'x', so they should get the same positive score.
        expect(scores[0]).toBeGreaterThan(0);
        expect(scores[0]).toBeCloseTo(scores[1], 10);
        expect(scores[1]).toBeCloseTo(scores[2], 10);
    });

    test("when k1 > 0, gains from term frequency eventually saturate", () => {
        const d1 = "dog cat cat cat cat cat cat cat cat cat"; // tf = 1
        const d3 = "dog dog dog cat cat cat cat cat cat cat"; // tf = 3
        const d9 = "dog dog dog dog dog dog dog dog dog cat"; // tf = 9
        const q = ["dog"];

        // Get the score for each doc so we can compare them
        // Keep k1 > 0 so TF is active and use normal b
        const s1 = (BM25([d1], q, { k1: 1.2, b: 0.75 }) as number[])[0];
        const s3 = (BM25([d3], q, { k1: 1.2, b: 0.75 }) as number[])[0];
        const s9 = (BM25([d9], q, { k1: 1.2, b: 0.75 }) as number[])[0];

        const delta13 = s3 - s1; // the increase of TF from 1 to 3 
        const delta39 = s9 - s3; // the increase of TF from 3 to 9

        // first increase should be bigger than the second
        expect(delta13).toBeGreaterThan(delta39);
    });
})
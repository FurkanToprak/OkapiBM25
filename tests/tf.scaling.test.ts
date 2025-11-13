import BM25 from "../BM25";

describe("TF scaling", () => {
    test("if more occurences of the term in a doc -> higher score when k1 > 0", () => {
        const docs = ["x", "x x", "x x x x"];
        const q = ["x"];
        /* Run BM25 with normal parameters (k1 > 0 = TF in play)
        Return an array of scores*/
        const scores = BM25(docs, q, {k1: 1.2, b: 0.75}) as number[];

        // TF active, [1] should be score higher than [0]
        expect(scores[0]).toBeLessThan(scores[1]);

        // TF active, [2] should be score higher than [1]
        expect(scores[1]).toBeLessThan(scores[2]);
    });

    test("k1 = 0 removes TF and make b = 0 to avoid length effects", () => {
        const d1 = "x y y y y y y y y y"; // tf=1
        const d3 = "x x x y y y y y y y"; // tf=3
        const d9 = "x x x x x x x x x y"; // tf=9
        const docs = [d1, d3, d9];
        const q = ["x"];

        /* Run BM25 with with k = 0 and b = 0, the document either contains 'x' or not.
        Return an array of scores, if it contains 'x', its score should be the same still*/
        const scores = BM25(docs, q, { k1: 0, b: 0.75 }) as number[]; // I THINK THERE IS A PROBLEM WITH K=0 IN BM25

        // All three have 'x', so all three should have the same positive score.
        expect(scores[0]).toBeGreaterThan(0);
        expect(scores[0]).toBeCloseTo(scores[1], 10);
        expect(scores[1]).toBeCloseTo(scores[2], 10);
    });

    test("TF saturation", () => {
        const d1 = "x y y y y y y y y y"; // tf=1
        const d3 = "x x x y y y y y y y"; // tf=3
        const d9 = "x x x x x x x x x y"; // tf=9
        const q = ["x"];

        // Get the score for each doc so we can compare them
        // Keep k1 > 0 so TF is active and use normal b
        const [s1] = BM25([d1], q, { k1: 1.2, b: 0.75 }) as number[];
        const [s3] = BM25([d3], q, { k1: 1.2, b: 0.75 }) as number[]; 
        const [s9] = BM25([d9], q, { k1: 1.2, b: 0.75 }) as number[];
    
        const delta13 = s3 - s1; // the increase of TF from 1 to 3 
        const delta39 = s9 - s3; // the increase of TF from 3 to 9

        expect(delta13).toBeGreaterThan(delta39);
    });
})


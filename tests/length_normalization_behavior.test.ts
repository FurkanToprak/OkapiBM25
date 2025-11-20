import BM25 from "../BM25";

describe("Length normalization behavior in BM25", () => {
    test("when b > 0 and TF is equal, shorter document scores higher", () => {
        const shortDoc = "dog cat cat cat"; // len = 4
        const longDoc = "dog " + "cat ".repeat(99).trim(); // len = 100
        const q = ["dog"];

        const scores = BM25([shortDoc, longDoc], q, { k1: 1.2, b: 0.75 }) as number[];
        expect(scores).toHaveLength(2); // scores length should be 2
        expect(scores[0]).toBeGreaterThan(scores[1]); // test: shorter > longer
    })

    test("when b = 0 (no length normalization), equal TF gives equal scores", () => {
        const shortDoc = "dog cat cat cat"; // tf = 1
        const longDoc = "dog " + "cat ".repeat(99).trim(); // tf = 1
        const q = ["dog"];

        const scores = BM25([shortDoc, longDoc], q, { k1: 1.2, b: 0 }) as number[];
        expect(scores).toHaveLength(2);
        expect(scores[0]).toBeCloseTo(scores[1], 10); // Expect numerical equality up to 10 decimals
    });

    test("when b = 1 (maximum normalization), model prefers shorter document", () => {
        const shortDoc = "dog cat cat cat";
        const longDoc = "dog " + "cat ".repeat(99).trim();
        const q = ["dog"];

        const scores = BM25([shortDoc, longDoc], q, { k1: 1.2, b: 1 }) as number[];
        expect(scores).toHaveLength(2);
        expect(scores[0]).toBeGreaterThan(scores[1]);
    });
})
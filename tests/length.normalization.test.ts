import BM25 from "../BM25";

describe("Length normalization", () => {
    test("with b>0, same TF, shorter scores higher", () => {
        const shortDoc = "x y y y"; // len=4
        const longDoc  = "x " + "y ".repeat(99).trim(); //len=100
        const q = ["x"];

        const scores = BM25([shortDoc, longDoc], q, { k1: 1.2, b: 0.75 }) as number[];
        expect(scores[0]).toBeGreaterThan(scores[1]); // test: shorter > longer
    })

    test("with b=0, length normalization off = equal score when TF equal", () => {
        const shortDoc = "x y y y"; //tf=1
        const longDoc = "x " + "y ".repeat(99).trim(); //tf=1
        const q = ["x"];

        const scores = BM25([shortDoc, longDoc], q, { k1: 1.2, b: 0 }) as number[];
        expect(scores[0]).toBeCloseTo(scores[1],10);
    });

    test("with b=1, maximum length = preference for shorter doc", () => {
        const shortDoc = "x y y y";
        const longDoc  = "x " + "y ".repeat(99).trim();
        const q = ["x"];

        const scores =BM25([shortDoc, longDoc], q, {k1: 1.2,b: 1 }) as number[];
        expect(scores[0]).toBeGreaterThan(scores[1]);
    });
})
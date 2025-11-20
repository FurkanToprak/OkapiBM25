import BM25, { getWordCount } from "../BM25";

/*
    Checking the "rarity effect" in BM25 by comparing scores for any rare term
    vs a very common term while keeping the document length and term counts equal.
*/
describe("Rare vs common term behavior in BM25", () => {
    test("rarer terms give a higher score than a very common term (Same TF, same length)", () => {
        const rareDoc = "zebra cat cat cat cat";
        const commonDoc = "dog cat cat cat cat";
        const fillers = Array.from({ length: 8}, () => "dog cat cat cat cat"); //make "dog" common
        const collection = [rareDoc, commonDoc, ...fillers]; // N = 10

        // length checks (all docs should be 5)
        expect(getWordCount(rareDoc)).toBe(5);
        expect(getWordCount(commonDoc)).toBe(5);
        fillers.forEach(f => expect(getWordCount(f)).toBe(5));

        const scoreOf = (query: string[], which: number) =>
            (BM25(collection, query, { k1: 1.2, b: 0.75 }) as number[])[which];

        const scoreRareDoc = scoreOf(["zebra"], 0); // rare term on doc
        const scoreCommonDoc = scoreOf(["dog"], 1); // Common term on doc

        expect(scoreRareDoc).toBeGreaterThan(scoreCommonDoc); // Rare > Common
    });

    test("If term appears in every document, its contribution should be almost same everywhere", () => {
        // "the" appears in every document, same length
        const docs = [
            "the cat cat cat cat",
            "the dog dog dog dog",
            "the zebra zebra zebra zebra"
        ]

        // length checks
        expect(getWordCount(docs[0])).toBe(5);
        expect(getWordCount(docs[1])).toBe(5);
        expect(getWordCount(docs[2])).toBe(5);
        
        const scores = BM25(docs, ["the"], { k1: 1.2, b:0.75 }) as number[];

        // Since "the" appears the same amount in each doc, scores should be close to equal.
        expect(scores[0]).toBeCloseTo(scores[1], 6);
        expect(scores[1]).toBeCloseTo(scores[2], 6);
    });
});
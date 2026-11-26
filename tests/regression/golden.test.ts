/**
 * Golden regression test.
 *
 * tests/regression/golden-v1.4.1.json holds the scores that the published
 * okapibm25@1.4.1 build gives for the fixed inputs in corpus.ts. The current
 * implementation has to reproduce them.
 *
 * After adding inputs to corpus.ts, regenerate the file from the frozen 1.4.1
 * build (never from the current code):
 *
 *   UPDATE_GOLDEN=1 npx jest tests/regression/golden.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import BM25, { BMDocument } from "../../BM25";
import LegacyBM25 from "./legacy-v1.4.1";
import { constants, documents, queries } from "./corpus";

interface GoldenCase {
  query: string[];
  constants: { b?: number; k1?: number } | null;
  scores: number[];
}

interface GoldenFile {
  source: string;
  documentCount: number;
  cases: GoldenCase[];
}

const goldenPath = join(__dirname, "golden-v1.4.1.json");

const buildGolden = (): GoldenFile => {
  const cases: GoldenCase[] = [];
  for (const query of queries) {
    for (const constant of constants) {
      cases.push({
        query,
        constants: constant === undefined ? null : constant,
        scores: LegacyBM25(documents, query, constant) as number[],
      });
    }
  }
  return { source: "okapibm25@1.4.1", documentCount: documents.length, cases };
};

if (process.env.UPDATE_GOLDEN === "1") {
  // One case per line keeps diffs readable.
  const fresh = buildGolden();
  const lines = fresh.cases.map((goldenCase) => "    " + JSON.stringify(goldenCase));
  writeFileSync(
    goldenPath,
    [
      "{",
      `  "source": ${JSON.stringify(fresh.source)},`,
      `  "documentCount": ${fresh.documentCount},`,
      '  "cases": [',
      lines.join(",\n"),
      "  ]",
      "}",
      "",
    ].join("\n")
  );
}

const golden: GoldenFile = existsSync(goldenPath)
  ? JSON.parse(readFileSync(goldenPath, "utf8"))
  : { source: "missing", documentCount: 0, cases: [] };

/** Math.log may differ in the last bit between engines, so compare with a relative tolerance. */
const expectScoresToMatch = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((score, index) => {
    const tolerance = 1e-12 * Math.max(1, Math.abs(expected[index]));
    expect(Math.abs(score - expected[index])).toBeLessThanOrEqual(tolerance);
  });
};

const describeCase = (goldenCase: GoldenCase) =>
  `${JSON.stringify(goldenCase.query)} with ${JSON.stringify(goldenCase.constants)}`;

describe("golden scores from okapibm25@1.4.1", () => {
  test("the golden file covers every query and every set of constants", () => {
    expect(golden.source).toBe("okapibm25@1.4.1");
    expect(golden.documentCount).toBe(documents.length);
    expect(golden.cases).toHaveLength(queries.length * constants.length);
    expect(
      golden.cases.map((goldenCase) => [goldenCase.query, goldenCase.constants])
    ).toEqual(
      buildGolden().cases.map((goldenCase) => [
        goldenCase.query,
        goldenCase.constants,
      ])
    );
  });

  test("the golden file is not trivial", () => {
    const allScores = golden.cases.reduce<number[]>(
      (all, goldenCase) => all.concat(goldenCase.scores),
      []
    );
    expect(allScores.every((score) => Number.isFinite(score))).toBe(true);
    expect(allScores.filter((score) => score > 0).length).toBeGreaterThan(200);
    expect(allScores.filter((score) => score === 0).length).toBeGreaterThan(200);
  });

  test("the frozen 1.4.1 build still reproduces the golden file", () => {
    for (const goldenCase of golden.cases) {
      const scores = LegacyBM25(
        documents,
        goldenCase.query,
        goldenCase.constants === null ? undefined : goldenCase.constants
      ) as number[];
      expectScoresToMatch(scores, goldenCase.scores);
    }
  });

  test.each(golden.cases.map((goldenCase) => [describeCase(goldenCase), goldenCase] as const))(
    "scores for %s",
    (_name, goldenCase) => {
      const scores = BM25(
        documents,
        goldenCase.query,
        goldenCase.constants === null ? undefined : goldenCase.constants
      );
      expectScoresToMatch(scores, goldenCase.scores);
    }
  );

  test.each(golden.cases.map((goldenCase) => [describeCase(goldenCase), goldenCase] as const))(
    "ranking for %s",
    (_name, goldenCase) => {
      const expected: BMDocument[] = documents
        .map((document, index) => ({ document, score: goldenCase.scores[index] }))
        .sort((first, second) => second.score - first.score);
      const ranked = BM25(
        documents,
        goldenCase.query,
        goldenCase.constants === null ? undefined : goldenCase.constants,
        (first, second) => second.score - first.score
      );
      expect(ranked.map((result) => result.document)).toEqual(
        expected.map((result) => result.document)
      );
      expectScoresToMatch(
        ranked.map((result) => result.score),
        expected.map((result) => result.score)
      );
    }
  );
});

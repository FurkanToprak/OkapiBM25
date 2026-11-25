/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  testMatch: ["<rootDir>/BM25.test.ts", "<rootDir>/tests/**/*.test.ts"],
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/BM25.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["json-summary", "html", "text-summary"],
};

// Types for the frozen okapibm25@1.4.1 build in legacy-v1.4.1.js.
export interface LegacyBMDocument {
  document: string;
  score: number;
}

export declare const getWordCount: (corpus: string) => number;
export declare const getTermFrequency: (term: string, corpus: string) => number;
export declare const getIDF: (term: string, documents: string[]) => number;

declare function LegacyBM25(
  documents: string[],
  keywords: string[],
  constants?: { b?: number; k1?: number },
  sorter?: (firstEl: LegacyBMDocument, secondEl: LegacyBMDocument) => number
): number[] | LegacyBMDocument[];

export default LegacyBM25;

export type IdfPolicy = "plain" | "nonnegative" | "plus1";

export function bm25Idf(N: number, df: number, policy: IdfPolicy = "nonnegative"): number {
    let val = Math.log((N - df + 0.5) / (df + 0.5));
    if (policy === "plain") return val;
    if (policy === "plus1") return Math.log((N - df + 0.5) / (df + 0.5) + 1);
    return Math.max(0, val);
}
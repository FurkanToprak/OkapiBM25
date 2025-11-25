import { Bench } from 'tinybench';
import BM25, { getWordCount } from "../BM25";

/*
    Benchmark BM25 scoring with different corpus sizes and query lengths.
        - Measures 1-term vs 3-term queries, and b=0 to isolate TF from length norm.
    Run:
        npm run bench
        # or override sizes
        SIZES=2000,10000,50000 npm run bench
*/

// Create a document of a fixed token length using a small vocabulary
function createDoc(n = 60) {
    const vocab = ['dog', 'cat', 'zebra', 'lion', 'the', 'mouse', 'ant'];
    let out: string[] = [];
    for (let i = 0; i < n; i++) out.push(vocab[(i * 31) % vocab.length]);
    return out.join(' ');
}

// Build a collection with N documents of identical length to control for length effects
function makeCorpus(nDocs: number, n = 60) {
    return Array.from({ length: nDocs }, () => createDoc(n));
}

const q1 = ['dog']; // Single-term query
const q3 = ['dog', 'cat', 'zebra']; // mutli-term query

// Collection sizes to benchmark
const SIZES = (process.env.SIZES || '1000,5000,10000')
    .split(',')
    .map(s => parseInt(s.trim(), 10));

(async () => {
    for (const N of SIZES) {
        const docs = makeCorpus(N, 60);

        // Mean document length
        const meanLen = docs.reduce((s, d) => s + getWordCount(d), 0) / docs.length;
        console.log(`\nCorpus N=${N}, meanLen≈${meanLen.toFixed(2)}`);

        // TinyBench options
        const bench = new Bench({ time: 1000, warmup: true });

        // Benchmark cases. Each 'add' is a task TinyBench will time.
        bench
            .add('BM25 1-term query', () => {
                BM25(docs, q1, { k1: 1.2, b: 0.75 });
            })
            .add('BM25 3-term query', () => {
                BM25(docs, q3, { k1: 1.2, b: 0.75 });
            })
            .add('BM25 (b=0, no length norm)', () => {
                BM25(docs, q3, { k1: 1.2, b: 0 });
            });

        // Run the benchmark
        await bench.run();

        /* Output results. 
            ops/sec = operations per second
            rme = relative margin of error (%)
            samples = number of samples taken
        */
        bench.tasks.forEach((t) => {
            console.log(
                `${t.name.padEnd(28)}  ${t.result?.hz.toFixed(2)} ops/sec  ` +
                `±${(t.result?.rme ?? 0).toFixed(2)}%  samples=${t.result?.samples.length}`
            );
        });
    }
})();
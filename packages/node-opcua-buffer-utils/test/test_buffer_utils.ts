import { Benchmarker } from "node-opcua-benchmarker";
import "mocha";

describe("testing buffer utils", function (this) {
    this.timeout(30000);

    it("buffer.allocUnsafe should be faster than Buffer.alloc(size)", (done) => {
        const bench = new Benchmarker();

        const n = 500;
        const total = 2 * 1024 * 1024;
        let i: number;

        // random weights, scaled so that the sizes always add up to exactly `total`
        const weights: number[] = [];
        let sumWeights = 0;
        for (i = 0; i < n; i++) {
            const w = Math.random();
            weights.push(w);
            sumWeights += w;
        }
        const sizes: number[] = [];
        let sumSizes = 0;
        for (i = 0; i < n; i++) {
            // at least 1 byte each, so that no zero-length buffer is allocated
            const size = Math.max(1, Math.floor((weights[i] / sumWeights) * (total - n)));
            sizes.push(size);
            sumSizes += size;
        }
        // hand the rounding leftover to the last entry
        sizes[n - 1] += total - sumSizes;
        console.log(sizes);

        for (i = 0; i < n; i++) {
            const _a = Buffer.allocUnsafe(sizes[i]);
            const _b = Buffer.alloc(sizes[i]);
        }

        bench
            .add("Buffer.alloc(size) 1", () => {
                let bufs: Buffer[] | null = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = Buffer.alloc(sizes[i]);
                }
                bufs = null;
            })
            .add("Buffer.allocUnsafe(size) 1", () => {
                let bufs: Buffer[] | null = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = Buffer.allocUnsafe(sizes[i]);
                }
                bufs = null;
            })
            .add("Buffer.alloc(size) 2", () => {
                let bufs: Buffer[] | null = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = Buffer.alloc(sizes[i]);
                }
                bufs = null;
            })
            .add("Buffer.allocUnsafe(size) 2", () => {
                let bufs: Buffer[] | null = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = Buffer.allocUnsafe(sizes[i]);
                }
                bufs = null;
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", () => {
                console.log(` Fastest is ${bench.fastest?.name}`);
                console.log(" Speed Up : x", bench.speedUp);

                done();
            })
            .run({ max_time: 0.5 });
    });
});

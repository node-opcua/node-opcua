// tslint:disable: no-console
import { Benchmarker, ITestRun } from "..";

describe("Testing Benchmarker", () => {
    it("forEach vs simple loops", (done) => {
        const bench = new Benchmarker();

        const values: number[] = [];
        for (let i = 0; i < 10000; i++) {
            values[i] = Math.random();
        }

        bench
            .add("for simple loop", () => {
                let sum = 0;
                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < values.length; i++) {
                    sum += values[i];
                }
            })
            .add("forEach        ", () => {
                let sum = 0;
                values.forEach((e) => {
                    sum += e;
                });
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", (fastest: ITestRun, speedUp: number) => {
                console.log(" Fastest is " + fastest.name);
                console.log(" Speed Up : x", speedUp);
                console.log(" count    :  ", fastest.result!.count);
                console.log(" ops/s    :  ", fastest.result!.ops);
                done();
            })
            .run({ max_time: 0.1 });
    });

    it("should benchmark async function ", async () => {

        const bench = new Benchmarker();

        async function test1() {
            await new Promise<void>((resolve) => setImmediate(() => {
                resolve();
            }));
        }
        async function test2() {
            await new Promise<void>((resolve) => process.nextTick(() => {
                resolve();
            }));
        }
        await bench
            .add("test1 - setImmediate", test1)
            .add("test2 - process.nextTick", test2)
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", (fastest: ITestRun, speedUp: number) => {
                console.log(" Fastest is " + fastest.name);
                console.log(" Speed Up : x", speedUp);
                console.log(" count    :  ", fastest.result!.count);
                console.log(" ops/s    :  ", fastest.result!.ops);
            })
            .run({ max_time: 0.25 });
    });

});

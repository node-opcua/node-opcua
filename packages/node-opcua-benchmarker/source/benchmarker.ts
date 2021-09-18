/***
 * @module node-opcua-benchmarker
 */
// tslint:disable:object-literal-shorthand
/// <reference types="node" />
import { EventEmitter } from "events";
import { isFunction } from "util";
import { assert } from "node-opcua-assert";
import hrtime = require("browser-process-hrtime");

export interface IPerformanceData {
    message: string;
    ops: number;
    count: number;
    total_time: number;
}

export interface IRunOptions {
    /**
     * max execution time in sec : default to 0.5 seconds.
     */
    max_time?: number;
    /**
     * specify the minimum number of time the benchmark-ed test cycle should be repeated
     */
    min_count?: number;
}

export type TestFunctionSync = () => void;
export type TestFunctionAsync = () => Promise<void>;
export type TestFunction = TestFunctionSync | TestFunctionAsync;
export interface ITestRun {
    name: string;
    functor: TestFunction;
    result?: IPerformanceData;
}

async function measure_cycle(func: TestFunction): Promise<number> {
    const start = hrtime(); // tuple [second, nanosecond]
    await func();
    const elapsed = hrtime(start);
    return elapsed[0] + elapsed[1] / 1000000000;
}

function minimum<T>(arr: T[], predicate: (t:T) => number) : T {
    return arr.reduce(
        (prev: T , current: T) => predicate(prev) < predicate(current) ? prev : current,
        arr[0]);
}

function maximum<T>(arr: T[], predicate: (t:T) => number) : T {
   return arr.reduce(
       (prev: T , current: T) => predicate(prev) > predicate(current) ? prev : current,
       arr[0]);
}

export interface IBenchmarkerEvent {
    on(event: "completed", listener: (this: Benchmarker, fastest: ITestRun, speedUp: number) => void): this;

    on(event: "cycle", listener: (message: string) => void): this;
}
export class Benchmarker extends EventEmitter implements IBenchmarkerEvent {

    /**
     * access the fastest test run
     */
    public fastest?: ITestRun;
    /**
     * access the slowest test run
     */
    public slowest?: ITestRun;

    /**
     * the speed up factor indicates how much faster is the faster ITestRun compare to the slowest.
     */
    public speedUp = 0;

    /***
     * @internal
     */
    private readonly suites: { [id: string]: ITestRun };

    constructor() {
        super();
        this.suites = {};
    }

    /**
     * Add a new test to the suite
     * @param name name of the tests
     * @param func the code that need to be stress
     */
    public add(name: string, func: TestFunction): Benchmarker {
        assert(isFunction(func));
        this.suites[name] = {
            functor: func,
            name: name,
        } as ITestRun;
        return this;
    }

    /**
     * run the benchmark
     * @param options
     */
    public async run(options?: IRunOptions): Promise<Benchmarker> {

        options = options || {};
        options.max_time = !options.max_time ? 0.5 : options.max_time;
        options.min_count = options.min_count || 5;

        for (const test of Object.values(this.suites)) {
            test.result = await this.measure_perf(test.name, test.functor, options!);
        }
        const pred = (bench: ITestRun)=> bench.result!.ops;
        // find fastest
        this.fastest = maximum(Object.values(this.suites), pred);
        this.slowest = minimum(Object.values(this.suites), pred);

        this.speedUp = Math.floor(this.fastest!.result!.ops / this.slowest!.result!.ops);

        this.emit("complete", this.fastest, this.speedUp);

        return this;
    }

    /**
     *
     * @param name
     * @param func
     * @param options
     * @internal
     */
    private async  measure_perf(name: string, func: TestFunction, options: IRunOptions): Promise<IPerformanceData> {
        
        let totalTime = 0;
        let count = 0;
        const maxTime = !options.max_time ? 0.5 : options.max_time;
        const minCount = options.min_count || 5;
        while (totalTime < maxTime || count < minCount) {
            totalTime += await measure_cycle(func);
            count += 1;
        }
        const ops = count / totalTime;
        const message = " CYCLE " + name + " op/s " + ((count / totalTime).toPrecision(7) + " count = " + count);
        this.emit("cycle", message);

        return {
            count: count,
            message: message,
            ops: ops,
            total_time: totalTime,
        } as IPerformanceData;
    }

}

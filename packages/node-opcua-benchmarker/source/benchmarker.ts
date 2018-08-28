/***
 * @module node-opcua-benchmarker
 */
// tslint:disable:object-literal-shorthand
/// <reference types="node" />
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";

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
     * specify the minimum number of time the benchmarked test cycle should be repeated
     */
    min_count?: number;
}

export interface ITestRun {
    name: string;
    functor: () => void;
    result?: IPerformanceData;
}

function measure_cycle(func: () => void): number {
    const start = process.hrtime(); // tuple [second, nanosecond]
    func();
    const elapsed = process.hrtime(start);
    return elapsed[0] + elapsed[1] / 1000000000;
}

export interface IBenchmarkerEvent {
    on(event: "completed", listener: () => void): this;

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
    public add(name: string, func: () => void): Benchmarker {
        assert(_.isFunction(func));
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
    public run(options?: IRunOptions) {

        options = options || {};
        options.max_time = !options.max_time ? 0.5 : options.max_time;
        options.min_count = options.min_count || 5;

        _.each(this.suites, (test) => {
            test.result = this.measure_perf(test.name, test.functor, options!);
        });

        // find fastest
        this.fastest = _.max(this.suites, (bench: ITestRun) => {
            return bench.result!.ops;
        });
        this.slowest = _.min(this.suites, (bench: ITestRun) => {
            return bench.result!.ops;
        });

        this.speedUp = Math.floor(this.fastest!.result!.ops / this.slowest!.result!.ops);

        this.emit("complete");

        return this;
    }

    /**
     *
     * @param name
     * @param func
     * @param options
     * @internal
     */
    private measure_perf(name: string, func: () => void, options: IRunOptions): IPerformanceData {
        assert(_.isFunction(func));
        let totalTime = 0;
        let count = 0;
        const maxTime = !options.max_time ? 0.5 : options.max_time;
        const minCount = options.min_count || 5;
        while (totalTime < maxTime || count < minCount) {
            totalTime += measure_cycle(func);
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

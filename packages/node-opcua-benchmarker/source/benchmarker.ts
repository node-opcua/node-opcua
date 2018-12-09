"use strict";
import { EventEmitter } from "events";
import * as _ from "underscore";
import { assert } from "node-opcua-assert";

export interface PerformanceData {
    message: string;
    ops: number;
    count: number;
    total_time: number;
}

export interface IRunOptions {
    max_time?: number;
    min_count?: number;
}

export interface TestRun {
    name: string;
    functor: () => void;
    result?: PerformanceData;
}

function measure_cycle(func: () => void): number {
    const start = process.hrtime(); // tuple [second, nanosecond]
    func();
    const elapsed = process.hrtime(start);
    return elapsed[0] + elapsed[1] / 1000000000;
}

export class Benchmarker extends EventEmitter {
    private readonly _suite: { [id: string]: TestRun };

    fastest?: TestRun;
    slowest?: TestRun;
    speedUp: number = 0;

    constructor() {
        super();
        this._suite = {};
    }

    add(name: string, func: () => void): Benchmarker {
        assert(_.isFunction(func));

        this._suite[name] = {
            name: name,
            functor: func
        } as TestRun;
        return this;
    }

    private measure_perf(name: string, func: () => void, options: IRunOptions): PerformanceData {
        assert(_.isFunction(func));
        let total_time = 0;
        let count = 0;
        const max_time = !options.max_time ? 0.5 : options.max_time;
        const min_count = options.min_count || 5;
        while (total_time < max_time || count < min_count) {
            total_time += measure_cycle(func);
            count += 1;
        }
        const ops = count / total_time;
        const message = " CYCLE " + name + " op/s " + ((count / total_time).toPrecision(7) + " count = " + count);
        this.emit("cycle", message);

        return {
            message: message,
            ops: ops,
            count: count,
            total_time: total_time
        } as PerformanceData;
    }

    run(options: IRunOptions) {
        options = options || {};
        options.max_time = !options.max_time ? 0.5 : options.max_time;
        options.min_count = options.min_count || 5;

        const self = this;
        _.each(this._suite, function(test) {
            test.result = self.measure_perf(test.name, test.functor, options);
        });

        // find fastest
        this.fastest = _.max(this._suite, function(bench) {
            return bench.result!.ops;
        });
        this.slowest = _.min(this._suite, function(bench) {
            return bench.result!.ops;
        });

        this.speedUp = Math.floor(this.fastest!.result!.ops / this.slowest!.result!.ops);

        this.emit("complete");

        return this;
    }
}

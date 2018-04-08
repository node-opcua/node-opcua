"use strict";
const util = require("util");
const EventEmitter = require("events").EventEmitter;
const async = require("async");
const _ = require("underscore");
const assert = require("node-opcua-assert");

const Benchmarker = function() {
    this._suite = {};
};
util.inherits(Benchmarker, EventEmitter);

Benchmarker.prototype.add = function(name, func) {
    assert(_.isFunction(func));

    this._suite[name] = {
        name: name,
        functor: func
    };
    return this;
};

function measure_cycle(func) {
    const start = process.hrtime(); // tuple [second, nanosecond]
    func.call();
    const elapsed = process.hrtime(start);
    return elapsed[0] + elapsed[1] / 1000000000;
}

Benchmarker.prototype.measure_perf = function(name, func, options) {
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
    };
};

Benchmarker.prototype.run = function(options) {
    options = options || {};
    options.max_time = !options.max_time ? 0.5 : options.max_time;
    options.min_count |= 5;

    const self = this;
    _.each(this._suite, function(test) {
        test.result = self.measure_perf(test.name, test.functor, options);
    });

    // find fastest
    this.fastest = _.max(this._suite, function(bench) {
        return bench.result.ops;
    });
    this.slowest = _.min(this._suite, function(bench) {
        return bench.result.ops;
    });

    this.speedUp = Math.floor(this.fastest.result.ops / this.slowest.result.ops);

    this.emit("complete");

    return this;
};
exports.Benchmarker = Benchmarker;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var async = require("async");
var _ = require("underscore");
var assert = require("assert");

var Benchmarker = function() {
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

    var start = process.hrtime();
    func.call();
    var elapsed = process.hrtime(start);
    return elapsed[0] +  elapsed[1]/1000000000;
}

Benchmarker.prototype.measure_perf = function(name,func,options) {

    assert(_.isFunction(func));
    var total_time =0;
    var count =0;
    var max_time = options.max_time || 0.5;
    var min_count = options.min_count || 5;
    while (total_time < max_time ||  count < min_count) {
        total_time += measure_cycle(func);
        count +=1;
    }
    var message = " CYCLE " + name + " op/s " + ( ( count )/ total_time );
    this.emit("cycle",message);

    return {
        message: message,
        ops: ( ( count )/ total_time ),
        count: count,
        total_time: total_time
    };
};

Benchmarker.prototype.run = function(options) {

    options |= {};
    options.max_time  |= 0.5;
    options.min_count |= 5;

    var self = this;
    _.each(this._suite,function(test){
        test.result = self.measure_perf(test.name,test.functor,options);
    });

    // find fastest
    this.fastest = _.max(this._suite,function(bench){ return bench.result.ops; });
    this.slowest = _.min(this._suite,function(bench){ return bench.result.ops; });

    this.speedUp = Math.floor(this.fastest.result.ops / this.slowest.result.ops);

    this.emit("complete");

    return this;
};
exports.Benchmarker = Benchmarker;
"use strict";
Error.stackTraceLimit = Infinity;

var assert = require("better-assert");
var _ = require("underscore");

require("colors");

var ObjectRegistry = require("node-opcua-utils/src/objectRegistry").ObjectRegistry;
ObjectRegistry.doDebug = true;
var trace = false;
//trace = true;

function get_stack() {
    var stack = (new Error()).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}

function verify_registry_counts(info) {
    /* jshint validthis: true */
    var errorMessages = [];

    var self = this;
    if (self.clearIntervalCallCount !== this.setIntervalCallCount) {
        errorMessages.push(" setInterval doesn't match number of clearInterval calls : " + this.setIntervalCallCount + " " + this.clearIntervalCallCount);
    }
    if (self.setTimeoutCallPendingCount !== 0) {
        errorMessages.push(" setTimeoutCallPendingCount is not zero: some timer are still pending " + this.setTimeoutCallPendingCount);
    }

    var monitoredResource = ObjectRegistry.registries;

    for (var i =0;i < monitoredResource.length;i++) {
        var res = monitoredResource[i];
        if (res.count() !== 0) {
            errorMessages.push(" some Resource have not been properly terminated: " + res.toString());
        }
    }

    if (errorMessages.length) {

        if (info) {
            console.log(" TRACE : ", info);
        }
        console.log(errorMessages.join("\n"));
        console.log("----------------------------------------------- more info");

        // console.log(this.map);
        _.forEach(self.map, function (value, key) {
            if (!value.disposed) {
                console.log("key =", key , "value.disposed = ",value.disposed);
                console.log(value.stack);//.split("\n"));
            }
        });
        throw new Error("LEAKS !!!" + errorMessages.join("\n"));
    }

}

exports.resourceLeakDetector = {

    start: function (info) {
        var self = this;
        if (trace) {
            console.log(" starting resourceLeakDetector");
        }
        assert(!self.setInterval_old,   " resourceLeakDetector.stop hasn't been called !");
        assert(!self.clearInterval_old, " resourceLeakDetector.stop hasn't been called !");
        assert(!self.setTimeout_old,    " resourceLeakDetector.stop hasn't been called !");
        assert(!self.clearTimeout_old,  " resourceLeakDetector.stop hasn't been called !");

        self.setIntervalCallCount = 0;
        self.clearIntervalCallCount = 0;
        self.setTimeoutCallPendingCount = 0;

        self.setInterval_old    = global.setInterval;
        self.clearInterval_old  = global.clearInterval;
        self.setTimeout_old     = global.setTimeout;
        self.clearTimeout_old   = global.clearTimeout;


        self.map = {};
        verify_registry_counts.call(self, info);

        if (false) {
            global.setTimeout = function (func, delay) {
                // detect invalid delays
                assert(delay !== undefined);
                assert(_.isFinite(delay));
                self.setTimeoutCallPendingCount++;
                self.setTimeout_old(function () {
                    self.setTimeoutCallPendingCount--;
                    func();
                }, delay);
            };
        }


        global.setInterval = function (func, delay) {
            assert(delay !== undefined);
            assert(_.isFinite(delay));

            self.setIntervalCallCount += 1;

            if (delay <= 10) {
                throw new Error("GLOBAL#setInterval called with a too small delay = " + delay.toString());
            }

            var key = self.setIntervalCallCount;
            var intervalId = self.setInterval_old(func, delay);


            self.map[key] = {
                intervalId: intervalId,
                disposed: false,
                stack: get_stack()
            };

            if (trace) {
                console.log("setInterval \n", get_stack().red, "\n");
            }

            return key;
        };

        global.clearInterval = function (id) {

            if (trace) {
                console.log("clearInterval " + id, get_stack().green);
            }
            var key = id;
            assert(self.map.hasOwnProperty(key));
            id = self.map[key].intervalId;

            self.map[key].disposed = true;

            self.clearIntervalCallCount += 1;
            return self.clearInterval_old(id);
        };


        // let's verify that we start with fresh registry objects
        var monitoredResource = ObjectRegistry.registries;
        for (var i =0;i < monitoredResource.length;i++) {
            var res = monitoredResource[i];
            if (res.count() !== 0) {
                throw new Error("Left over");
            }
        }

        // if (false) {
        //     this._running_server_count = OPCUAServer.registry.count();
        //     assert(this._running_server_count === 0);
        //     assert(MonitoredItem.registry.count() === 0);
        // }

    },

    stop: function (info) {
        var self = this;

        if (trace) {
            console.log(" stop resourceLeakDetector");
        }
        assert(_.isFunction(self.setInterval_old), " did you forget to call resourceLeakDetector.start() ?");

        global.setInterval = self.setInterval_old;
        self.setInterval_old = null;

        global.clearInterval = self.clearInterval_old;
        self.clearInterval_old = null;

        global.setTimeout = self.setTimeout_old;
        self.setTimeout_old = null;

        global.clearTimeout = self.clearTimeout_old;
        self.clearTimeout_old = null;

        verify_registry_counts.call(self, info);
    }
};

var trace_from_this_projet_only = require("node-opcua-debug").trace_from_this_projet_only;

exports.installResourceLeakDetector = function (isGlobal, func) {

    var trace = trace_from_this_projet_only(new Error());
    if (isGlobal) {
        before(function () {
            exports.resourceLeakDetector.start();
        });
        if (func) {
            func.call(this);
        }
        after(function () {
            exports.resourceLeakDetector.stop();
        });

    } else {
        beforeEach(function () {
            exports.resourceLeakDetector.start();
        });
        afterEach(function () {
            exports.resourceLeakDetector.stop(trace);
        });
    }
};


exports.describeWithLeakDetector= function(message,func) {
    describe.call(this,message,function() {
        exports.installResourceLeakDetector.call(this,true,func);
    });
};




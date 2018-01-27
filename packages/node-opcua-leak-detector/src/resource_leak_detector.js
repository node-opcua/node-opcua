"use strict";
Error.stackTraceLimit = Infinity;

var assert = require("node-opcua-assert");
var _ = require("underscore");

require("colors");

var ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
ObjectRegistry.doDebug = true;
var trace = false;

//trace = true;

function get_stack() {
    var stack = (new Error()).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}

const monitor_intervals = false;


function ResourceLeakDetector() {
    var self = this;

    self.setIntervalCallCount = 0;
    self.clearIntervalCallCount = 0;

    self.setTimeoutCallCount = 0;
    self.clearTimeoutCallCount = 0;
    self.honoredTimeoutFuncCallCount = 0;
    self.setTimeoutCallPendingCount = 0;

    self.interval_map ={};
    self.timeout_map ={};
}

/**
 * @method verify_registry_counts
 * @private
 * @param info
 * @return {boolean}
 */
ResourceLeakDetector.prototype.verify_registry_counts = function (info) {
    var errorMessages = [];

    var self = this;

    if (self.clearIntervalCallCount !== self.setIntervalCallCount) {
        errorMessages.push(" setInterval doesn't match number of clearInterval calls : \n      " +
                           " setIntervalCallCount = "  + self.setIntervalCallCount +
                           " clearIntervalCallCount = " + self.clearIntervalCallCount);
    }
    if ((self.clearTimeoutCallCount +self.honoredTimeoutFuncCallCount) !== self.setTimeoutCallCount) {
          errorMessages.push(" setTimeout doesn't match number of clearTimeout or achieved timer calls : \n     " +
                             " setTimeoutCallCount = " + self.setTimeoutCallCount +
                             " clearTimeoutCallCount = " + self.clearTimeoutCallCount +
                             " honoredTimeoutFuncCallCount = " + self.honoredTimeoutFuncCallCount);
    }
    if (self.setTimeoutCallPendingCount !== 0) {
        errorMessages.push(" setTimeoutCallPendingCount is not zero: some timer are still pending " +
          self.setTimeoutCallPendingCount);
    }

    var monitoredResource = ObjectRegistry.registries;

    for (var i = 0; i < monitoredResource.length; i++) {
        var res = monitoredResource[i];
        if (res.count() !== 0) {
            errorMessages.push(" some Resource have not been properly terminated: " + res.toString());
        }
    }

    if (errorMessages.length) {

//xx        if (info) {
//xx            console.log(" TRACE : ", info);
//xx        }
        console.log(errorMessages.join("\n"));
        console.log("----------------------------------------------- more info");

        console.log("||||||||||||||||||||||||||||||||||||||||||||||||||||||||||    setInterval/clearInterval");
        _.forEach(self.interval_map, function (value, key) {
            if (!value.disposed) {
                console.log("key =", key, "value.disposed = ", value.disposed);
                console.log(value.stack);//.split("\n"));
            }
        });


        console.log("||||||||||||||||||||||||||||||||||||||||||||||||||||||||||    setTimeout/clearTimeout");
        _.forEach(self.timeout_map, function (value, key) {
            if (value && !value.disposed) {
                console.log("setTimeout key =", key, "value.disposed = ", value.disposed);
                console.log(value.stack);//.split("\n"));
            }
        });


        console.log("LEAKS in  => ", self.ctx ? self.ctx.test.parent.file + "  " + self.ctx.test.parent.title.cyan : "???");
        throw new Error("LEAKS !!!" + errorMessages.join("\n"));
    }

};

global.hasResourceLeakDetector = true;
ResourceLeakDetector.prototype.start = function (info) {

    global.ResourceLeakDetectorStarted = true;

    var self = ResourceLeakDetector.singleton;
    if (trace) {
        console.log(" starting resourceLeakDetector");
    }
    assert(!self.setInterval_old, "resourceLeakDetector.stop hasn't been called !");
    assert(!self.clearInterval_old, "resourceLeakDetector.stop hasn't been called !");
    assert(!self.setTimeout_old, "resourceLeakDetector.stop hasn't been called !");
    assert(!self.clearTimeout_old, "resourceLeakDetector.stop hasn't been called !");

    self.setIntervalCallCount = 0;
    self.clearIntervalCallCount = 0;

    self.setInterval_old = global.setInterval;
    self.clearInterval_old = global.clearInterval;

    self.setTimeoutCallCount = 0;
    self.clearTimeoutCallCount = 0;
    self.setTimeoutCallPendingCount = 0;
    self.honoredTimeoutFuncCallCount = 0;
    self.setTimeout_old = global.setTimeout;
    self.clearTimeout_old = global.clearTimeout;

    self.interval_map = {};
    self.timeout_map = {};

    self.verify_registry_counts(self, info);

    if (monitor_intervals) {
        global.setTimeout = function (func, delay) {

            assert(arguments.length === 2, "current limitation:  setTimeout must be called with 2 arguments");
            // detect invalid delays
            assert(delay !== undefined);
            assert(_.isFinite(delay));
            if (delay < 0) {
                console.log("GLOBAL#setTimeout called with a too small delay = " + delay.toString());
                throw new Error("GLOBAL#setTimeout called with a too small delay = " + delay.toString());
            }

            // increase number of pending timers
            self.setTimeoutCallPendingCount += 1;

            // increase overall timeout counter;
            self.setTimeoutCallCount += 1;

            var key = self.setTimeoutCallCount;

            var timeoutId = self.setTimeout_old(function () {

                if (self.timeout_map[key].isCleared) {
                    // throw new Error("Invalid timeoutId, timer has already been cleared - " + key);
                    console.log("WARNING : setTimeout:  Invalid timeoutId, timer has already been cleared - " + key);
                    return;
                }
                if (self.timeout_map[key].hasBeenHonored) {
                    throw new Error("setTimeout:  "+ key + " time out has already been honored");
                }
                self.honoredTimeoutFuncCallCount += 1;
                self.setTimeoutCallPendingCount -= 1;

                self.timeout_map[key].hasBeenHonored = true;
                self.timeout_map[key].disposed = true;
                func();

            }, delay);

            self.timeout_map[key] = {
                timeoutId: timeoutId,
                disposed: false,
                stack: get_stack() // stack when created
            };
            return key + 100000;
        };

        global.clearTimeout = function (timeoutId) {
            // workaround for a bug in 'backoff' module, which call clearTimeout with -1 ( invalid ide)
            if (timeoutId === -1) {
                console.log("warning clearTimeout is called with illegal timeoutId === 1, this call will be ignored ( backoff module bug?)");
                return;
            }

            if (timeoutId>=0 && timeoutId< 100000) {
                throw new Error("clearTimeout has been called instead of clearInterval");
            }
            timeoutId -= 100000;

            if (!self.timeout_map[timeoutId]) {
                console.log("timeoutId" + timeoutId, " has already been discarded or doesn't exist");
                console.log("self.timeout_map", self.timeout_map);
                throw new Error("clearTimeout: Invalid timeoutId " + timeoutId + " this may happen if clearTimeout is called inside the setTimeout function");
            }
            if (self.timeout_map[timeoutId].isCleared) {
                throw new Error("clearTimeout: Invalid timeoutId " + timeoutId + " time out has already been cleared");
            }
            if (self.timeout_map[timeoutId].hasBeenHonored) {
                throw new Error("clearTimeout: Invalid timeoutId " + timeoutId + " time out has already been honored");
            }

            self.timeout_map[timeoutId].isCleared = true;
            self.timeout_map[timeoutId].disposed = true;

            self.setTimeoutCallPendingCount -= 1;

            // increase overall timeout counter;
            self.clearTimeoutCallCount += 1;

            //xx console.log(" xxx                          xxxxxxxxx = >clearTimeout".yellow, timeoutId, self.setTimeoutCallPendingCount);
            //xx console.log(new Error().stack);

            var ret = self.timeout_map[timeoutId];
            //xx self.timeout_map[timeoutId] = null;
            //xx delete self.timeout_map[timeoutId];
            return self.clearTimeout_old(ret.timeoutId);
        };

    }

    global.setInterval = function (func, delay) {
        assert(arguments.length === 2);
        assert(delay !== undefined);
        assert(_.isFinite(delay));
        if (delay <= 10) {
            throw new Error("GLOBAL#setInterval called with a too small delay = " + delay.toString());
        }

        // increase number of pending timers
        self.setIntervalCallCount += 1;

        var key = self.setIntervalCallCount;

        var intervalId = self.setInterval_old(func, delay);

        self.interval_map[key] = {
            intervalId: intervalId,
            disposed: false,
            stack: get_stack()
        };

        if (trace) {
            console.log("setInterval \n", get_stack().red, "\n");
        }

        return key;
    };

    global.clearInterval = function (intervalId) {

        if ( intervalId>= 100000) {
            throw new Error("clearInterval has been called instead of clearTimeout");
        }
        self.clearIntervalCallCount += 1;

        if (trace) {
            console.log("clearInterval " + intervalId, get_stack().green);
        }
        var key = intervalId;
        assert(self.interval_map.hasOwnProperty(key));
        intervalId = self.interval_map[key].intervalId;

        self.interval_map[key].disposed = true;

        return self.clearInterval_old(intervalId);
    };

};

ResourceLeakDetector.prototype.check = function () {

};

ResourceLeakDetector.prototype.stop = function (info) {
    global.ResourceLeakDetectorStarted =false;

    var self = ResourceLeakDetector.singleton;
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

    return self.verify_registry_counts(info);
};

ResourceLeakDetector.singleton = new ResourceLeakDetector();
var resourceLeakDetector = ResourceLeakDetector.singleton;

var trace_from_this_project_only = require("node-opcua-debug").trace_from_this_projet_only;

exports.installResourceLeakDetector = function (isGlobal, func) {

    var trace = trace_from_this_project_only(new Error());

    if (isGlobal) {
        before(function () {
            var self = this;
            resourceLeakDetector.ctx = self.test.ctx;
            resourceLeakDetector.start();
        });
        if (func) {
            func.call(this);
        }
        after(function () {
            resourceLeakDetector.stop(null);
            resourceLeakDetector.ctx = false;
        });

    } else {
        beforeEach(function () {
            var self = this;
            resourceLeakDetector.ctx = self.test.ctx;
            resourceLeakDetector.start();
        });
        afterEach(function () {
            resourceLeakDetector.stop(trace);
            resourceLeakDetector.ctx = false;
        });

    }
};

var global_describe = describe;
assert(_.isFunction(global_describe)," expecting mocha to be defined");

var g_indescribeWithLeakDetector = false;
exports.describeWithLeakDetector = function (message, func) {
    if (g_indescribeWithLeakDetector) {
        return global_describe(message,func);
    }
    g_indescribeWithLeakDetector = true;
    global_describe.call(this, message, function () {
        exports.installResourceLeakDetector.call(this, true,func);
        g_indescribeWithLeakDetector = false;
    });
};




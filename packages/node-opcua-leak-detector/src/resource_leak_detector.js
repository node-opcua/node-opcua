"use strict";
Error.stackTraceLimit = Infinity;

const chalk = require("chalk");
const { assert } = require("node-opcua-assert");

const { ObjectRegistry } = require("node-opcua-object-registry");
const trace = false;


function get_stack() {
    const stack = (new Error("Stack Trace recording")).stack.split("\n");
    return stack.slice(2, 7).join("\n");
}

const monitor_intervals = false;


function ResourceLeakDetector() {

    this.setIntervalCallCount = 0;
    this.clearIntervalCallCount = 0;

    this.setTimeoutCallCount = 0;
    this.clearTimeoutCallCount = 0;
    this.honoredTimeoutFuncCallCount = 0;
    this.setTimeoutCallPendingCount = 0;

    this.interval_map = {};
    this.timeout_map = {};
}

/**
 * @method verify_registry_counts
 * @private
 * @param info
 * @return {boolean}
 */
ResourceLeakDetector.prototype.verify_registry_counts = function(info) {
    const errorMessages = [];

    if (this.clearIntervalCallCount !== this.setIntervalCallCount) {
        errorMessages.push(" setInterval doesn't match number of clearInterval calls : \n      " +
            " setIntervalCallCount = " + this.setIntervalCallCount +
            " clearIntervalCallCount = " + this.clearIntervalCallCount);
    }
    if ((this.clearTimeoutCallCount + this.honoredTimeoutFuncCallCount) !== this.setTimeoutCallCount) {
        errorMessages.push(" setTimeout doesn't match number of clearTimeout or achieved timer calls : \n     " +
            " setTimeoutCallCount = " + this.setTimeoutCallCount +
            " clearTimeoutCallCount = " + this.clearTimeoutCallCount +
            " honoredTimeoutFuncCallCount = " + this.honoredTimeoutFuncCallCount);
    }
    if (this.setTimeoutCallPendingCount !== 0) {
        errorMessages.push(" setTimeoutCallPendingCount is not zero: some timer are still pending " +
            this.setTimeoutCallPendingCount);
    }

    const monitoredResource = ObjectRegistry.registries;

    let totalLeak = 0;
    for (let i = 0; i < monitoredResource.length; i++) {
        const res = monitoredResource[i];
        if (res.count() !== 0) {
            errorMessages.push(chalk.cyan(" some Resource have not been properly terminated: \n"));
            errorMessages.push(" " + res.toString());
        }
        totalLeak += res.count();
    }

    if (errorMessages.length) {

        if (!info.silent) {

            console.log(chalk.bgWhite.red("+----------------------------------------------------------------------------------------+"));
            console.log(chalk.bgWhite.red("|                         RESOURCE LEAK DETECTED !!!                                     |"));
            console.log(chalk.bgWhite.red("+----------------------------------------------------------------------------------------+"));

            console.log("----------------------------------------------- more info");

            console.log(chalk.cyan("test filename                    : "), this.ctx ? this.ctx.test.parent.file + "  " + this.ctx.test.parent.title : "???");
            console.log(chalk.cyan("setInterval/clearInterval leaks  : "), Object.entries(this.interval_map).length);
            for (const [key, value] of Object.entries(this.interval_map)) {
                if (value && !value.disposed) {
                    console.log("key =", key, "value.disposed = ", value.disposed);
                    console.log(value.stack);//.split("\n"));
                }
            }
            console.log(chalk.cyan("setTimeout/clearTimeout leaks    : "), Object.entries(this.timeout_map).length);
            for (const [key, value] of Object.entries(this.timeout_map)) {
                if (value && !value.disposed) {
                    console.log("setTimeout key =", key, "value.disposed = ", value.disposed);
                    console.log(value.stack);//.split("\n"));
                }
            }
            console.log(chalk.cyan("object leaks                     : "), totalLeak);
            for (const resource of Object.values(monitoredResource)) {
                if (resource.count() !== 0) {
                    console.log("   ", chalk.yellow(resource.getClassName()).padEnd(38), ":", resource.count());
                }
            }

            console.log(errorMessages.join("\n"));


            console.log("you can get trace information if you set NODEOPCUA_REGISTRY=DEBUG and rerun")
            //
            throw new Error("LEAKS !!!" + errorMessages.join("\n"));
        }
    }
};

global.hasResourceLeakDetector = false;
ResourceLeakDetector.prototype.start = function(info) {

    global.ResourceLeakDetectorStarted = true;

    const self = ResourceLeakDetector.singleton;

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
        global.setTimeout = function(func, delay) {

            assert(arguments.length === 2, "current limitation:  setTimeout must be called with 2 arguments");
            // detect invalid delays
            assert(delay !== undefined);
            assert(isFinite(delay));
            if (delay < 0) {
                console.log("GLOBAL#setTimeout called with a too small delay = " + delay.toString());
                throw new Error("GLOBAL#setTimeout called with a too small delay = " + delay.toString());
            }

            // increase number of pending timers
            self.setTimeoutCallPendingCount += 1;

            // increase overall timeout counter;
            self.setTimeoutCallCount += 1;

            const key = self.setTimeoutCallCount;

            const timeoutId = self.setTimeout_old(function() {

                if (!self.timeout_map[key] || self.timeout_map[key].isCleared) {
                    // throw new Error("Invalid timeoutId, timer has already been cleared - " + key);
                    console.log("WARNING : setTimeout:  Invalid timeoutId, timer has already been cleared - " + key);
                    return;
                }
                if (self.timeout_map[key].hasBeenHonored) {
                    throw new Error("setTimeout:  " + key + " time out has already been honored");
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

        global.clearTimeout = function(timeoutId) {
            // workaround for a bug in 'backoff' module, which call clearTimeout with -1 ( invalid ide)
            if (timeoutId === -1) {
                console.log("warning clearTimeout is called with illegal timeoutId === 1, this call will be ignored ( backoff module bug?)");
                return;
            }

            if (timeoutId >= 0 && timeoutId < 100000) {
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

            const data = self.timeout_map[timeoutId];
            self.timeout_map[timeoutId] = null;

            data.isCleared = true;
            data.disposed = true;

            self.setTimeoutCallPendingCount -= 1;

            // increase overall timeout counter;
            self.clearTimeoutCallCount += 1;

            // call original clearTimeout
            const retValue = self.clearTimeout_old(data.timeoutId);

            //xx delete self.timeout_map[timeoutId];
            return retValue;
        };

    }

    global.setInterval = function(func, delay) {
        assert(arguments.length === 2);
        assert(delay !== undefined);
        assert(isFinite(delay));
        if (delay <= 10) {
            throw new Error("GLOBAL#setInterval called with a too small delay = " + delay.toString());
        }

        // increase number of pending timers
        self.setIntervalCallCount += 1;

        const key = self.setIntervalCallCount;

        const intervalId = self.setInterval_old(func, delay);

        let stack = null;
        try {
            stack = get_stack();
        }
        catch (err) {
            /**  */
        }
        self.interval_map[key] = {
            intervalId: intervalId,
            disposed: false,
            stack: stack
        };

        if (trace) {
            console.log("setInterval \n", get_stack(), "\n");
        }

        return key;
    };

    global.clearInterval = function(intervalId) {

        if (intervalId >= 100000) {
            throw new Error("clearInterval has been called instead of clearTimeout");
        }
        self.clearIntervalCallCount += 1;

        if (trace) {
            console.log("clearInterval " + intervalId, get_stack());
        }
        const key = intervalId;

        const data = self.interval_map[key];

        self.interval_map[key] = null;
        delete self.interval_map[key];

        data.disposed = true;
        const retValue = self.clearInterval_old(data.intervalId);

        return retValue;
    };

};

ResourceLeakDetector.prototype.check = function() {
    /**  */
};

ResourceLeakDetector.prototype.stop = function(info) {
    if (!global.ResourceLeakDetectorStarted) {
        return;
    }
    global.ResourceLeakDetectorStarted = false;

    const self = ResourceLeakDetector.singleton;
    if (trace) {
        console.log(" stop resourceLeakDetector");
    }
    assert(typeof self.setInterval_old === "function", " did you forget to call resourceLeakDetector.start() ?");

    global.setInterval = self.setInterval_old;
    self.setInterval_old = null;

    global.clearInterval = self.clearInterval_old;
    self.clearInterval_old = null;

    global.setTimeout = self.setTimeout_old;
    self.setTimeout_old = null;

    global.clearTimeout = self.clearTimeout_old;
    self.clearTimeout_old = null;


    const results = self.verify_registry_counts(info);

    self.interval_map = {};
    self.timeout_map = {};


    // call garbage collector
    if (typeof global.gc === "function") {
        global.gc(true);
    }

    const doHeapdump = false;
    if (doHeapdump) {
        const heapdump = require('heapdump');
        heapdump.writeSnapshot(function(err, filename) {
            console.log('dump written to', filename);
        });
    }

    return results;
};

ResourceLeakDetector.singleton = new ResourceLeakDetector();
const resourceLeakDetector = ResourceLeakDetector.singleton;

const { traceFromThisProjectOnly } = require("node-opcua-debug");

let testHasFailed = false;

exports.installResourceLeakDetector = function(isGlobal, func) {

    const trace = traceFromThisProjectOnly();
    testHasFailed = false;
    if (isGlobal) {
        before(function() {
            testHasFailed = false;
            resourceLeakDetector.ctx = this.test.ctx;
            resourceLeakDetector.start();
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
        });
        beforeEach(function() {
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
        });
        if (func) {
            func.call(this);
        }
        after(function() {
            resourceLeakDetector.stop({ silent: testHasFailed });
            resourceLeakDetector.ctx = false;
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
        });

    } else {
        beforeEach(function() {

            if (global.gc) {
                global.gc(true);
            }
            resourceLeakDetector.ctx = this.test.ctx;
            resourceLeakDetector.start();
        });
        afterEach(function() {
            resourceLeakDetector.stop({ silent: testHasFailed });
            resourceLeakDetector.ctx = false;
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
        });

    }
};

const global_describe = describe;
const global_it = it;
function replacement_it(testName, f) {
    if (!f) { return; }
    if (f.length) {
        const f1 = function(done) {
            f.call(this, (err) => {
                if (err) {
                    testHasFailed = true;
                }
                done(err);
            });
        }
        global_it(testName, f1);
        return;
    }
    const ff = async function() {
        let r;
        try {
            r = await f.call(this);
        }
        catch (err) {
            testHasFailed = true;
            throw err;
        }
        return r;
    }
    global_it(testName, ff);
}
assert(typeof global_describe === "function", " expecting mocha to be defined");


let g_inDescribeWithLeakDetector = false;
exports.describeWithLeakDetector = function(message, func) {
    if (g_inDescribeWithLeakDetector) {
        return global_describe(message, func);
    }
    g_inDescribeWithLeakDetector = true;
    global.it = replacement_it;
    global_describe.call(this, message, function() {
        exports.installResourceLeakDetector.call(this, true, func);
        g_inDescribeWithLeakDetector = false;
        global.it = global_it;
    });
};




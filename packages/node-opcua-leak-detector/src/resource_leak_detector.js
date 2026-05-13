Error.stackTraceLimit = 30;
const chalk = require("chalk");
const { assert } = require("node-opcua-assert");

const { ObjectRegistry } = require("node-opcua-object-registry");
const { takeMemorySnapshot, checkForMemoryLeak } = require("./mem_leak_detector");

const trace = false;

const memLeakDetectionDisabled = process.env.MEM_LEAK_DETECTION_DISABLED === "true";
if (memLeakDetectionDisabled) {
    console.log("[LeakDetector] ⚠️  Memory leak detection is disabled");
} else {
    // if MEM_LEAK_DETECTION_DISABLED is undefined, inform the user that it exists
    if (process.env.MEM_LEAK_DETECTION_DISABLED === undefined) {
        console.log("[LeakDetector] ℹ️  Memory leak detection is enabled. Set MEM_LEAK_DETECTION_DISABLED=true to disable it.");
    }
}

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
ResourceLeakDetector.prototype.verify_registry_counts = (info) => {
    const self = ResourceLeakDetector.singleton;
    const errorMessages = [];

    if (self.clearIntervalCallCount !== self.setIntervalCallCount) {
        errorMessages.push(` setInterval doesn't match number of clearInterval calls : \n      ` +
            ` setIntervalCallCount = ${self.setIntervalCallCount}` +
            ` clearIntervalCallCount = ${self.clearIntervalCallCount}`);
    }
    if ((self.clearTimeoutCallCount + self.honoredTimeoutFuncCallCount) !== self.setTimeoutCallCount) {
        errorMessages.push(` setTimeout doesn't match number of clearTimeout or achieved timer calls : \n     ` +
            ` setTimeoutCallCount = ${self.setTimeoutCallCount}` +
            ` clearTimeoutCallCount = ${self.clearTimeoutCallCount}` +
            ` honoredTimeoutFuncCallCount = ${self.honoredTimeoutFuncCallCount}`);
    }
    if (self.setTimeoutCallPendingCount !== 0) {
        errorMessages.push(` setTimeoutCallPendingCount is not zero: some timer are still pending ${self.setTimeoutCallPendingCount}`);
    }

    const monitoredResource = ObjectRegistry.registries;

    let totalLeak = 0;
    for (let i = 0; i < monitoredResource.length; i++) {
        const res = monitoredResource[i];
        if (res.count() !== 0) {
            errorMessages.push(chalk.cyan(" some Resource have not been properly terminated: \n"));
            errorMessages.push(` ${res.toString()}`);
        }
        totalLeak += res.count();
    }

    if (errorMessages.length) {

        if (!info.silent) {

            console.log(chalk.bgWhite.red("+----------------------------------------------------------------------------------------+"));
            console.log(chalk.bgWhite.red("|                         RESOURCE LEAK DETECTED !!!                                     |"));
            console.log(chalk.bgWhite.red("+----------------------------------------------------------------------------------------+"));

            console.log("----------------------------------------------- more info");

            console.log(chalk.cyan("test filename                    : "), self.ctx ? `${self.ctx.test.parent.file}  ${self.ctx.test.parent.title}` : "???");
            console.log(chalk.cyan("setInterval/clearInterval leaks  : "), Object.entries(self.interval_map).length);
            for (const [key, value] of Object.entries(self.interval_map)) {
                if (value && !value.disposed) {
                    console.log("key =", key, "value.disposed = ", value.disposed);
                    console.log(value.stack);
                }
            }
            console.log(chalk.cyan("setTimeout/clearTimeout leaks    : "), Object.entries(self.timeout_map).length);
            for (const [key, value] of Object.entries(self.timeout_map)) {
                if (value && !value.disposed) {
                    console.log("setTimeout key =", key, "value.disposed = ", value.disposed);
                    console.log(value.stack);
                }
            }
            console.log(chalk.cyan("object leaks                     : "), totalLeak);
            for (const resource of Object.values(monitoredResource)) {
                if (resource.count() !== 0) {
                    console.log("   ", chalk.yellow(resource.getClassName()).padEnd(38), ":", resource.count());
                }
            }

            console.log(errorMessages.join("\n"));

            console.log("you can get trace information if you set NODEOPCUA_REGISTRY=DEBUG and rerun");
            //
            throw new Error(`LEAKS !!!${errorMessages.join("\n")}`);
        }
    }
};

global.hasResourceLeakDetector = false;
ResourceLeakDetector.prototype.start = (info) => {

    global.ResourceLeakDetectorStarted = true;

    const self = ResourceLeakDetector.singleton;



    if (trace) {
        console.log("[LeakDetector] 🚀 starting resourceLeakDetector");
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

    // Track active timer handles for cleanup in stop().
    // This is a lightweight tracking that doesn't wrap the API (no assertions,
    // no wrapper objects) — it just records handles so stop() can clear them.
    self._activeTimeouts = new Set();

    if (monitor_intervals) {
        global.setTimeout = (func, delay, ...extra) => {

            assert(extra.length === 0, "current limitation:  setTimeout must be called with 2 arguments");
            // detect invalid delays
            assert(delay !== undefined);
            assert(Number.isFinite(delay));
            if (delay < 0) {
                console.log(`[LeakDetector] ❌ GLOBAL#setTimeout called with a too small delay = ${delay}`);
                throw new Error(`[LeakDetector] ❌ GLOBAL#setTimeout called with a too small delay = ${delay}`);
            }

            // increase number of pending timers
            self.setTimeoutCallPendingCount += 1;

            // increase overall timeout counter;
            self.setTimeoutCallCount += 1;

            const key = self.setTimeoutCallCount;

            const timeoutId = self.setTimeout_old(() => {

                if (!self.timeout_map[key] || self.timeout_map[key].isCleared) {
                    console.log(`[LeakDetector] ❌ WARNING : setTimeout:  Invalid timeoutId, timer has already been cleared - ${key}`);
                    return;
                }
                if (self.timeout_map[key].hasBeenHonored) {
                    throw new Error(`[LeakDetector] ❌ setTimeout:  ${key} time out has already been honored`);
                }
                self.honoredTimeoutFuncCallCount += 1;
                self.setTimeoutCallPendingCount -= 1;

                self.timeout_map[key].hasBeenHonored = true;
                self.timeout_map[key].disposed = true;
                func();

            }, delay);

            self.timeout_map[key] = {
                timeoutId,
                disposed: false,
                stack: get_stack() // stack when created
            };

            // Return a wrapper that acts as the key (for clearTimeout)
            // but also exposes ref/unref/hasRef from the real Timeout
            const wrapper = {
                [Symbol.toPrimitive]() { return key + 100000; },
                ref() { timeoutId.ref(); return wrapper; },
                unref() { timeoutId.unref(); return wrapper; },
                hasRef() { return timeoutId.hasRef(); },
                _key: key + 100000
            };
            return wrapper;
        };

        global.clearTimeout = (timeoutId) => {
            // workaround for a bug in 'backoff' module, which call clearTimeout with -1 ( invalid id)
            if (timeoutId === -1) {
                console.log("[LeakDetector] ❌ warning clearTimeout is called with illegal timeoutId === -1, this call will be ignored ( backoff module bug?)");
                return;
            }

            // Support both raw keys (number) and wrapper objects (from our proxy)
            timeoutId = (timeoutId && timeoutId._key !== undefined) ? timeoutId._key : +timeoutId;

            if (timeoutId >= 0 && timeoutId < 100000) {
                throw new Error("[LeakDetector] ❌ clearTimeout has been called instead of clearInterval");
            }
            timeoutId -= 100000;

            if (!self.timeout_map[timeoutId]) {
                console.log(`timeoutId${timeoutId}`, " has already been discarded or doesn't exist");
                console.log("self.timeout_map", self.timeout_map);
                throw new Error(`clearTimeout: Invalid timeoutId ${timeoutId} this may happen if clearTimeout is called inside the setTimeout function`);
            }
            if (self.timeout_map[timeoutId].isCleared) {
                throw new Error(`clearTimeout: Invalid timeoutId ${timeoutId} time out has already been cleared`);
            }
            if (self.timeout_map[timeoutId].hasBeenHonored) {
                throw new Error(`clearTimeout: Invalid timeoutId ${timeoutId} time out has already been honored`);
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

            return retValue;
        };

    } else {
        // Lightweight setTimeout/clearTimeout tracking (no assertions, no wrapper IDs).
        // We just record raw timer handles so stop() can clear leaked ones.
        global.setTimeout = (fn, ...rest) => {
            const handle = self.setTimeout_old(() => {
                // Timer fired naturally — remove from tracking
                self._activeTimeouts.delete(handle);
                fn();
            }, ...rest);
            self._activeTimeouts.add(handle);
            return handle;
        };
        global.clearTimeout = (handle) => {
            self._activeTimeouts.delete(handle);
            return self.clearTimeout_old(handle);
        };
    }

    global.setInterval = (func, delay, ...extra) => {
        assert(extra.length === 0);
        assert(delay !== undefined);
        assert(Number.isFinite(delay));
        if (delay <= 10) {
            throw new Error(`[LeakDetector] ⏰ GLOBAL#setInterval called with a too small delay = ${delay}`);
        }

        // increase number of pending timers
        self.setIntervalCallCount += 1;

        const key = self.setIntervalCallCount;

        const intervalId = self.setInterval_old(func, delay);

        let stack = null;
        try {
            stack = get_stack();
        }
        catch (_err) {
            /**  */
        }
        self.interval_map[key] = {
            intervalId,
            disposed: false,
            stack
        };

        if (trace) {
            console.log("setInterval \n", get_stack(), "\n");
        }

        // Return a wrapper that acts as the key (for clearInterval)
        // but also exposes ref/unref/hasRef from the real Timeout
        const wrapper = {
            [Symbol.toPrimitive]() { return key; },
            ref() { intervalId.ref(); return wrapper; },
            unref() { intervalId.unref(); return wrapper; },
            hasRef() { return intervalId.hasRef(); },
            _key: key
        };
        return wrapper;
    };

    global.clearInterval = (intervalId) => {

        // Support both raw keys (number) and wrapper objects (from our proxy)
        const key = (intervalId && intervalId._key !== undefined) ? intervalId._key : +intervalId;

        if (key >= 100000) {
            throw new Error("[LeakDetector] 🔄 clearInterval has been called instead of clearTimeout");
        }
        self.clearIntervalCallCount += 1;

        if (trace) {
            console.log(`[LeakDetector] 🔄 clearInterval ${key}`, get_stack());
        }

        const data = self.interval_map[key];

        self.interval_map[key] = null;
        delete self.interval_map[key];

        data.disposed = true;
        const retValue = self.clearInterval_old(data.intervalId);

        return retValue;
    };

};

ResourceLeakDetector.prototype.check = () => {
    /**  */
};

ResourceLeakDetector.prototype.stop = (info) => {
    if (!global.ResourceLeakDetectorStarted) {
        return;
    }
    global.ResourceLeakDetectorStarted = false;

    const self = ResourceLeakDetector.singleton;
    if (trace) {
        console.log("[LeakDetector] stop resourceLeakDetector");
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

    // Clear any remaining tracked timeouts/intervals to prevent process hang.
    // Mocha 12+ does not call process.exit() unless --exit is set, so any
    // ref'd timer will keep the event loop alive indefinitely.
    for (const [, data] of Object.entries(self.interval_map)) {
        if (data && !data.disposed) {
            global.clearInterval(data.intervalId);
        }
    }
    for (const [, data] of Object.entries(self.timeout_map)) {
        if (data && !data.disposed) {
            global.clearTimeout(data.timeoutId);
        }
    }
    // Also clear lightweight-tracked timeout handles (monitor_intervals=false mode)
    if (self._activeTimeouts && self._activeTimeouts.size > 0) {
        // Count only ref'd handles (those that would prevent process exit)
        const leakedRefHandles = [...self._activeTimeouts].filter(
            (h) => typeof h.hasRef === "function" && h.hasRef()
        );
        if (leakedRefHandles.length > 0 && !info.silent) {
            console.log(chalk.yellow(`[LeakDetector] ⚠️  ${leakedRefHandles.length} setTimeout handle(s) were not cleared!`));
        }
        for (const handle of self._activeTimeouts) {
            global.clearTimeout(handle);
        }
        self._activeTimeouts.clear();
    }
    self.interval_map = {};
    self.timeout_map = {};

    // call garbage collector
    if (typeof global.gc === "function") {
        global.gc(true);
    }

    // Diagnostic: dump active handles to identify what keeps the event loop alive
    if (trace && typeof process._getActiveHandles === "function") {
        const handles = process._getActiveHandles();
        const refHandles = handles.filter((h) => typeof h.hasRef !== "function" || h.hasRef());
        console.log(`[LeakDetector] 🔍 stop(): checking ${refHandles.length} active handles`);
        for (const h of refHandles) {
            const type = h.constructor ? h.constructor.name : typeof h;
            console.log(`[LeakDetector]   handle: ${type}`);
        }
    }

    // Note: we no longer schedule a process.exit() timer here.
    // The previous 2s unref'd timer was meant to handle tsx keeping
    // ref'd stdout handles alive, but it caused premature exits when
    // run_all_mocha_tests.js runs multiple suites in a single process.
    // The test runner's own process.exit(failures) handles cleanup.

    return results;
};

ResourceLeakDetector.singleton = new ResourceLeakDetector();
const resourceLeakDetector = ResourceLeakDetector.singleton;

// Local implementation to break cyclic dependency with node-opcua-debug
function traceFromThisProjectOnly(err) {
    const str = [];
    str.push(" display_trace_from_this_project_only = ");
    if (err) {
        str.push(err.message);
    }
    err = err || new Error("Error used to extract stack trace");
    let stack = err.stack;
    if (stack) {
        stack = stack.split("\n").filter((el) => el.match(/node-opcua/) && !el.match(/node_modules/));
        str.push(stack.join("\n"));
    } else {
        str.push(" NO STACK TO TRACE !!!!");
    }
    return str.join("\n");
}

let testHasFailed = false;

exports.installResourceLeakDetector = function(isGlobal, func) {

    const _trace = traceFromThisProjectOnly();
    testHasFailed = false;

    let beforeOverallSnapshot;
    let afterOverallSnapshot;
    let beforeSnapshot;
    let afterSnapshot;
    if (isGlobal) {
        before(function(/*this: Mocha.Suite*/) {
            testHasFailed = false;
            resourceLeakDetector.ctx = this.test.ctx;
            resourceLeakDetector.start();
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
            beforeOverallSnapshot = takeMemorySnapshot();

        });
        beforeEach(() => {
            // takeMemorySnapshot now does its own major GC; no need for an
            // explicit gc(true) here. Saves one ~100ms major-GC stall per test.
            beforeSnapshot = takeMemorySnapshot();
        });
        if (func) {
            func.call(this);
        }
        after(async () => {

            resourceLeakDetector.stop({ silent: testHasFailed });
            resourceLeakDetector.ctx = false;
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
            // give some time to relax
            afterOverallSnapshot = takeMemorySnapshot();
            checkForMemoryLeak(beforeOverallSnapshot, afterOverallSnapshot);

        });
        afterEach(async () => {
            afterSnapshot = takeMemorySnapshot();

        });

    } else {
        beforeEach(function(/*this: Mocha.Test*/) {
            // takeMemorySnapshot now does its own major GC; no separate gc(true) here.
            resourceLeakDetector.ctx = this.test.ctx;
            resourceLeakDetector.start();
            beforeSnapshot = takeMemorySnapshot();
        });
        afterEach(async () => {
            resourceLeakDetector.stop({ silent: testHasFailed });
            resourceLeakDetector.ctx = false;
            // make sure we start with a garbage collected situation
            if (global.gc) {
                global.gc(true);
            }
            // give some time to relax
            await new Promise((resolve) => setTimeout(resolve, 200));
            afterSnapshot = takeMemorySnapshot();
            checkForMemoryLeak(beforeSnapshot, afterSnapshot);
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
        };
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
    };
    global_it(testName, ff);
}
assert(typeof global_describe === "function", " expecting mocha to be defined");


let g_inDescribeWithLeakDetector = false;
exports.describeWithLeakDetector = function(message, func) {

    if (memLeakDetectionDisabled) {
        return global_describe(message, func);
    }

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

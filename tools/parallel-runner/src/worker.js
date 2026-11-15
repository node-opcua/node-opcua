const { isMainThread, parentPort, workerData } = require("node:worker_threads");
const util = require("node:util");
// .default: chalk 6 is ESM-only, so require() hands back the module namespace
// object rather than the instance, and every chalk.<style>() would be undefined.
const chalk = require("chalk").default;
// side-effect: extends Object.prototype with .should — test files rely on it
// being loaded by the runner (they don't import "should" themselves). The old
// single-file runner got this for free because the worker re-executed the same
// entry file, whose top-level require("should") ran in the worker thread.
require("should");
const { Mocha } = require("mocha");

const { runtests } = require("./mocha_runner.js");

if (isMainThread) {
    return;
}

const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_TEST_BEGIN,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
    EVENT_TEST_PENDING
} = Mocha.Runner.constants;

const t = () => {
    const d = new Date();
    return `${d.toTimeString().split(" ")[0]}:${d.getMilliseconds().toString().padStart(3, "0")} `;
};
class ParallelMochaReporter {
    /**
     *
     * @param {Mocha.Runner} runner
     */
    constructor(runner) {
        this._indents = 0;
        this.counter = 0;
        this.maxMem = 0;
        this.maxDeltaTest = "";
        this.total = runner.total;
        this.outputLines = [];
        this.oldConsoleLog = null;

        // hooks and pending tests fire FAIL/PENDING without a TEST_BEGIN, so there
        // may be nothing saved: only restore what was actually swapped out
        // (restoring null made the next console.log throw and killed the file)
        this.restoreConsole = () => {
            if (this.oldConsoleLog) {
                console.log = this.oldConsoleLog;
            }
            this.oldConsoleLog = null;
        };
        const redirectConsoleLog = (...args) => {
            /** */
            this.outputLines.push(t() + util.format.apply(null, args));
        };
        runner
            .once(EVENT_RUN_BEGIN, () => {
                // console.log("start");
            })
            .on(EVENT_SUITE_BEGIN, (_test) => {
                // console.log("  " + this.indent() + chalk.yellow(test.title), test.fullTitle());
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.outputLines = [];
                this.oldConsoleLog = console.log;
                console.log = redirectConsoleLog;
                console.log(`  ${this.indent()}${chalk.cyan(test.title)}`, chalk.magenta(test.file));
                this.counter++;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, (test) => {
                this.restoreConsole();
                /** */
                console.log(`  ${chalk.yellow(test.fullTitle())}`);
                // console.log("  " + this.indent() + chalk.green(test.title));
                const { duration, file, error, timedOut, state, stats, title } = test;
                const output = this.outputLines;
                this.outputLines = [];
                const titlePath = test.titlePath();
                parentPort.postMessage({
                    type: EVENT_TEST_PASS,
                    test: { duration, file, error, timedOut, state, stats, title, output, titlePath }
                });
            })
            .on(EVENT_TEST_PENDING, (test) => {
                this.restoreConsole();
                console.log(`  ${chalk.yellow(test.fullTitle())}`);
                /** */
                const { duration, file, error, timedOut, state, stats, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                this.outputLines = [];
                parentPort.postMessage({
                    type: EVENT_TEST_PENDING,
                    test: { duration, file, error, timedOut, state, stats, title, output, titlePath }
                });
                // console.log("  " + this.indent() + chalk.yellow(test.title));
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                console.log(err.message);
                console.log(err.stack);
                console.log(`  ${chalk.red(test.fullTitle())}`);
                console.log(test.file);
                const { duration, file, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                this.outputLines = [];
                // hook failures carry the error on `err`, not test.error (which
                // stays undefined) - forward whichever is present, else the CI log
                // prints "undefined" and the real cause is lost
                const error = err ? (err.stack || err.message || String(err)) : test.error;
                parentPort.postMessage({
                    type: EVENT_TEST_FAIL,
                    test: { duration, file, title, output, titlePath, error }
                });
                this.restoreConsole();
            })
            .once(EVENT_RUN_END, () => {
                /** */
            });
    }
    indent() {
        return Array(this._indents).join("  ");
    }

    increaseIndent() {
        this._indents++;
    }
    decreaseIndent() {
        this._indents--;
    }
}

let g_file = "";
console.log = (...args) => {
    try {
        const line = util.format.apply(null, ["L       ", t(), ...args]);
        parentPort.postMessage({ type: "LOG", file: g_file, page: undefined, line });
    } catch (err) {
        console.log(err);
    }
};
console.warn = (...args) => {
    try {
        const line = util.format.apply(null, ["W       ", t(), ...args]);
        parentPort.postMessage({ type: "LOG", file: g_file, page: undefined, line });
    } catch (err) {
        console.log(err);
    }
};

console.error = (...args) => {
    try {
        const line = util.format.apply(null, ["E       ", t(), ...args]);
        parentPort.postMessage({ type: "LOG", file: g_file, page: undefined, line });
    } catch (_err) {
        /* parent gone, nothing useful to do */
    }
};

async function workerThread() {
    const { page: _page, selectedTests, g } = workerData;

    // console.log("Worker started", page, selectedTests.length);
    for (const file of selectedTests) {
        parentPort.postMessage({ type: "TEST_FILE_STARTED", file });
    }
    g_file = selectedTests[0];
    const reporter = ParallelMochaReporter;
    // a file that cannot be loaded (syntax error, broken import) runs no test at
    // all; it must surface as a failure, not as a silently "completed" file
    const reportFileError = (file, title, err) => {
        parentPort.postMessage({
            type: EVENT_TEST_FAIL,
            test: {
                duration: 0,
                file,
                title,
                output: [],
                titlePath: [title],
                error: err ? err.stack || err.message || String(err) : title
            }
        });
    };
    try {
        await runtests({
            reporter,
            dryRun: false,
            filterOpts: g,
            selectedTests,
            onLoadError: (file, err) => reportFileError(file, "test file could not be loaded", err)
        });
    } catch (err) {
        for (const file of selectedTests) {
            reportFileError(file, "test runner crashed", err);
        }
    }
    for (const file of selectedTests) {
        parentPort.postMessage({ type: "TEST_FILE_COMPLETED", file });
    }
}

module.exports.workerThread = workerThread;

// This file is the worker entry (cli.js spawns new Worker("src/worker.js")).
// In the main thread the guard at the top of the file already returned, so
// reaching this line means we are inside a worker: run immediately.
workerThread();

const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const util = require("util");
const chalk = require("chalk");
const Mocha = require("mocha");

const { runtests } = require("./run_all_mocha_tests.js");

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
    EVENT_TEST_SKIPPED
} = Mocha.Runner.constants;

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

        const redirectConsoleLog = (...args) => {
            /** */
            this.outputLines.push(util.format.apply(null, args));
        };
        runner
            .once(EVENT_RUN_BEGIN, () => {
                // console.log("start");
            })
            .on(EVENT_SUITE_BEGIN, (test) => {
                // console.log("  " + this.indent() + chalk.yellow(test.title), test.fullTitle());
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.outputLines = [];
                this.oldConsoleLog = console.log;
                console.log = redirectConsoleLog;
                console.log("  " + this.indent() + chalk.cyan(test.title), chalk.magenta(test.file));
                this.counter++;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, (test) => {
                console.log = this.oldConsoleLog;
                this.oldConsoleLog = null;
                /** */
                console.log("  " + chalk.yellow(test.fullTitle()));
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
            .on(EVENT_TEST_SKIPPED, (test) => {
                console.log("  " + chalk.yellow(test.fullTitle()));
                console.log = this.oldConsoleLog;
                this.oldConsoleLog = null;
                console.log("  " + chalk.yellow(test.fullTitle()));
                /** */
                const { duration, file, error, timedOut, state, stats, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                this.outputLines = [];
                parentPort.postMessage({
                    type: EVENT_TEST_SKIPPED,
                    test: { duration, file, error, timedOut, state, stats, title, output, titlePath }
                });
                // console.log("  " + this.indent() + chalk.yellow(test.title));
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                console.log(err.message);
                console.log(err.stack);
                console.log("  " + chalk.red(test.fullTitle()));
                console.log(test.file);
                const { duration, file, error, timedOut, state, stats, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                this.outputLines = [];
                parentPort.postMessage({
                    type: EVENT_TEST_FAIL,
                    test: { duration, file, timedOut, state, stats, title, output, titlePath }
                });
                console.log = this.oldConsoleLog;
                this.oldConsoleLog = null;
                console.log("done");
                //xx                process.exit(1);
                /** */
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
        args = args.map(util.format);
        parentPort.postMessage({ type: "LOG", file: g_file, page: undefined, args });
    } catch (err) {
        console.log(err);
    }
};
console.warn = (...args) => {
    try {
        args = args.map(util.format);
        parentPort.postMessage({ type: "LOG", file: g_file, page: undefined, args });
    } catch (err) {
        console.log(err);
    }
};

async function workerThread() {
    const { page, selectedTests, g } = workerData;

    // console.log("Worker started", page, selectedTests.length);
    for (const file of selectedTests) {
        parentPort.postMessage({ type: "TEST_FILE_STARTED", file });
    }
    g_file = selectedTests[0];
    const reporter = ParallelMochaReporter;
    const failures = await runtests({ reporter, dryRun: false, filterOpts: g, selectedTests });
    for (const file of selectedTests) {
        parentPort.postMessage({ type: "TEST_FILE_COMPLETED", file });
    }
}

module.exports.workerThread = workerThread;

#!node
const fs = require("node:fs");
const path = require("node:path");
const chalk = require("chalk");
const Mocha = require("mocha");
require("mocha-clean");

const tsx = require("tsx/cjs/api");
tsx.register();

// Register tsx ESM loader hooks so that Mocha's import()
// fallback can transpile .ts files in "type": "module" packages.
// Requires Node.js >= 20.6
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
register("tsx/esm/api", pathToFileURL(__filename));

Error.stackTraceLimit = 20;

const doDebug = !!process.env.DEBUG;

// Capture unhandled rejections and uncaught exceptions at the runner level
// so future TCC2-style regressions (tests that schedule async assertions
// without awaiting them) surface as a clear [FATAL] message with the
// offending test's name and the rejection stack — instead of a confusing
// exit code (e.g. 127) and a noisy "Unhandled Rejection" cascade.
//
// Exit codes the runner can emit (see the IIFE at the bottom):
//   0 — all tests passed
//   1 — one or more tests failed (any count, clamped to 1)
//   2 — unhandled rejection or uncaught exception during the run
//  -1 — outer try/catch in the IIFE caught an error
let fatalError = null;
let currentTestTitle = "<runner setup>";

process.on("unhandledRejection", (reason) => {
    if (!fatalError) fatalError = reason;
    console.error("\n[FATAL] Unhandled Rejection");
    console.error("[FATAL] during test: " + currentTestTitle);
    console.error(reason && reason.stack ? reason.stack : reason);
});

process.on("uncaughtException", (err) => {
    if (!fatalError) fatalError = err;
    console.error("\n[FATAL] Uncaught Exception");
    console.error("[FATAL] during test: " + currentTestTitle);
    console.error(err && err.stack ? err.stack : err);
});

async function collect_files(testFiles, testFolder) {

    const files = await fs.promises.readdir(testFolder);
    for (const file of files) {
        let f = path.join(testFolder, file);

        const stat = await fs.promises.lstat(f);
        if (stat.isDirectory()) {
            await collect_files(testFiles, f);
        } else {
            if (file.match(/^test_.*\.ts/) && !file.match(/^test_.*\.d\.ts/)) {
                doDebug && console.log("     - adding file ", f);
                testFiles.push(f);
            } else if (file.match(/^test_.*\.js/)) {
                // make sure that there is not a TS file along side
                if (fs.existsSync(f.replace(".js", ".ts"))) {
                    console.log("warning => transpiled js file ignored : ", file);
                } else {
                    doDebug && console.log("     - adding file ", f);
                    testFiles.push(f);
                }
            } else {
                doDebug && console.log("     - (skipping file ", f, ")");
            }
        }
    }
}

async function extractAllTestFiles() {
    let testFiles = [];

    const promises = [];
    const files = await fs.promises.readdir(__dirname);
    for (const file of files) {
        // if (file!== "node-opcua-address-space") {
        //     continue;
        // }

        const testFolder = path.join(__dirname, file, "test");
        if (fs.existsSync(testFolder) && fs.lstatSync(testFolder).isDirectory()) {
            doDebug && console.log("collecting test files from ", testFolder);
            promises.push(collect_files(testFiles, testFolder));
        }
    }
    await Promise.all(promises);

    testFiles = testFiles.sort();
    return testFiles;
}
exports.extractAllTestFiles = extractAllTestFiles;

async function extractPageTest(testFiles, { page, pageCount, pageSize }) {
    // -------------------------------------------------
    // portion
    if (page !== undefined) {
        if (page === -1) {
            // display test page
            let i = 0;
            while (testFiles) {
                console.log("\n --------------------------------- Page ", i);
                const a = testFiles.slice(i * pageSize, (i + pageCount) * pageSize);
                if (a.length === 0) {
                    return;
                }
                for (const f of a) {
                    console.log("        " + f);
                }

                i++;
            }

            process.exit(0);
        }
        testFiles = testFiles.slice(page * pageSize, (page + 1) * pageSize);

        // console.log(" Testing with test page : " + page, pageSize);
        // console.log(testFiles[0]);
        // console.log(testFiles[testFiles.length - 1]);
    }
    return testFiles;
}
exports.extractPageTest = extractPageTest;

async function extractTestFiles({ page, pageCount, pageSize }) {
    let testFiles = await extractAllTestFiles();
    return await extractPageTest(testFiles, { page, pageCount, pageSize });
}

function test_no_leak(file) {
    let sourceCode = fs.readFileSync(file, "utf-8");
    if (sourceCode.match("OPCUAClient")) {
        if (!sourceCode.match("Leak")) {
            console.log(chalk.yellow(" OPCUAClient without leak detection mechanism  !!!"), file);
        }
    }
}

function forceGC() {
    if (global.gc) {
        global.gc();
    } else {
        // console.warn('No GC hook! Start your program as `node --expose-gc file.js`.');
    }
}

const doHeapSnapshot = !!process.env["HEAPSNAPSHOT"];
const doHeapSnapshotGlobal = true;
let heapdump = null;
try {
    heapdump = require("heapdump");
} catch (_err) {
    /** */
}

function checkMemoryConsumption() {
    _
    // Only force a full GC when heap snapshots are requested.
    // Forcing GC on every test (~2 calls per test) adds 70-110ms
    // per call and degrades progressively as the heap grows,
    // consuming 40-60% of total wall-clock time in long runs.
    if (doHeapSnapshot) {
        forceGC();
    }
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return used;
}

Mocha.reporters.Base.color;

const heapsnapshot = Date.now().toString();
const oldConsole = console.log;
function myConsoleLog() {
    /**  */
}
const symbols = {
    ok: "✓",
    err: "✖",
    dot: "․",
    comma: ",",
    bang: "!"
};
if (process.platform === "win32") {
    symbols.ok = "\u221A";
    symbols.err = "\u00D7";
    symbols.dot = ".";
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
class MyReporter {
    constructor(runner) {
        this._indents = 0;
        this.counter = 0;
        this.maxMem = 0;
        this.maxDeltaTest = "";
        const stats = runner.stats;
        this.total = runner.total;
        runner
            .once(EVENT_RUN_BEGIN, () => {
                console.log("start");

                if (doHeapSnapshotGlobal && heapdump) heapdump.writeSnapshot(`./${heapsnapshot}.start.heapsnapshot`);
            })
            .on(EVENT_SUITE_BEGIN, (test) => {
                if (process.stdout.cursorTo && process.stdout.clearLine) {
                    process.stdout.clearLine(); // clear current text
                    process.stdout.cursorTo(0); // move cursor to beginning of line
                }
                console.log(`                  ${this.indent()}${chalk.yellow(test.title)}`);
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.counter++;
                const mem = checkMemoryConsumption();
                // console.log(`The script uses approximately ${Math.round(mem * 100) / 100} MB`);
                this.memBefore = mem;
                const memInfo = mem.toPrecision(5);
                this.displayStatus(test, chalk.cyan(symbols.dot), chalk.grey(memInfo), "", "\r");
                if (doHeapSnapshot && heapdump)
                    heapdump.writeSnapshot(`./${Date.now()}.start.${this.counter}.heapsnapshot`);

                this.old_console = console.log;
                console.log = myConsoleLog;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, (test) => {
                console.log = oldConsole;

                const _color = Mocha.reporters.Base.color;
                const extra = test.duration > 500 ? chalk.greenBright(` (${test.duration}ms)`) : "";
                const mem = checkMemoryConsumption();
                if (mem > this.maxMem) {
                    this.maxMem = Math.max(mem, this.maxMem);
                }
                let memInfo = mem.toPrecision(5);
                if (mem - this.memBefore > 10) {
                    memInfo = chalk.redBright(memInfo);
                } else if (mem - this.memBefore > 1) {
                    memInfo = chalk.red(memInfo);
                } else {
                    memInfo = chalk.grey(memInfo);
                }
                this.displayStatus(test, chalk.greenBright(symbols.ok), memInfo, extra, "\n");
                if (doHeapSnapshot && heapdump)
                    heapdump.writeSnapshot(`./${Date.now()}.end.${this.counter}.heapsnapshot`);
            })
            .on(EVENT_TEST_SKIPPED, (test) => {
                console.log = oldConsole;
                this.displayStatus(test, chalk.red(symbols.bang), "     ", "", "\n");
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                console.log = oldConsole;

                this.displayStatus(test, chalk.red(symbols.err), "     ", "", "\n");
                console.log(err);
            })
            .once(EVENT_RUN_END, () => {
                const mem = checkMemoryConsumption();
                let memInfo = mem.toPrecision(5);
                console.log(`end: ${stats.passes} / ${stats.passes + stats.failures} ok   (mem = ${memInfo} MB)`);
                console.log(`total test: ${this.total}`);
                console.log("max mem =", this.maxMem.toPrecision(5), "MB");
                if (doHeapSnapshotGlobal && heapdump) heapdump.writeSnapshot(`./${heapsnapshot}.end.heapsnapshot`);
            });
    }
    displayStatus(test, status, mem, extra, ending) {
        extra = extra || "";
        try {
            if (process.stdout.cursorTo && process.stdout.clearLine) {
                process.stdout.cursorTo(0); // move cursor to beginning of line
                process.stdout.clearLine(); // clear current text
                process.stdout.cursorTo(0); // move cursor to beginning of line
            }
            const title = `${this.indent()}${status} ${test.title}`;
            const progress = `${this.counter.toString().padStart(4, " ")}/${this.total}`;
            process.stdout.write(`${mem} ${progress} ${title}${extra}${ending}`);
            return mem;
        } catch (err) {
            console.log(err);
        }
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

async function runtests({ selectedTests, reporter, dryRun, filterOpts, skipped }) {
    // Instantiate a Mocha instance.
    const mocha = new Mocha({
        bail: true,
        fullTrace: true,
        grep: filterOpts,
        dryRun,
        timeout: 80000,
        /*
        fullTrace: true,
        parallel: true,
        jobs: 16,
        */
        // growl: true,
        // checkLeaks: true,
        reporter,
        slow: 6000
    });

    const suite = mocha.suite;
    suite.on("pre-require", (_global, _file, _self) => {
        //   console.log("pre-require", file);
    });
    suite.on("require", (_script, _file, _self) => {
        /* */
    });
    suite.on("post-require", (_global, _file, _self) => {
        //  console.log("post   -require", file);
    });

    let count = 0;
    for (const file of selectedTests) {
        test_no_leak(file);
        if (skipped === undefined || count >= skipped) {
            mocha.addFile(file);
        }
        count++;
    }
    mocha.timeout(200000);
    mocha.bail(true);

    // Use async file loading so Mocha can fall back to import()
    // for .ts files in "type": "module" packages
    mocha.lazyLoadFiles(true);
    await mocha.loadFilesAsync();

    return await new Promise((resolve) => {
        const runner = mocha.run((failures) => {
            resolve(failures);
        });
        // Track the currently-running test so the unhandledRejection /
        // uncaughtException handlers above can name it in their [FATAL] output.
        runner.on(Mocha.Runner.constants.EVENT_TEST_BEGIN, (test) => {
            currentTestTitle = test.fullTitle();
        });
    });
    // Run the tests.
}
module.exports.runtests = runtests;

if (require.main === module) {
    let filterOpts = process.argv[process.argv.length - 1];
    if (filterOpts.match(/run_all_mocha/)) {
        filterOpts = "";
    }
    if (filterOpts) {
        console.log("test filter = ", filterOpts);
    }

    const skipped = process.env.SKIPPED ? parseInt(process.env.SKIPPED, 10) : 0;
    const pageCount = parseInt(process.env.PAGECOUNT || "0", 10) || 1;
    const pageSize = parseInt(process.env.PAGESIZE || "0", 10) || 1;
    const page = process.env.TESTPAGE ? parseInt(process.env.TESTPAGE, 10) : undefined;

    let reporter = process.env.REPORTER || "spec"; //"nyan", //"tap"
    if (process.env.NODEOPCUATESTREPORTER) {
        reporter = MyReporter;
    }
    (async () => {
        try {
            const selectedTests = await extractTestFiles({ page, pageSize, pageCount });
            const failures = await runtests({ selectedTests, reporter, skipped, filterOpts });
            if (fatalError) {
                console.error("[FATAL] Exiting with code 2 due to unhandled error during run");
                process.exit(2);
            }
            // Clamp to 0/1 so CI gets a clean signal regardless of how many
            // tests failed. process.exit(N) silently truncates to 8 bits on
            // Unix, so e.g. process.exit(383) yields exit code 127 — the
            // same as one shell convention for "command not found", which
            // would be misleading.
            process.exit(failures > 0 ? 1 : 0);
        } catch (err) {
            console.log("---------------------------------- mocha run error");
            console.log(err);
            process.exit(-1);
        }
    })();
}

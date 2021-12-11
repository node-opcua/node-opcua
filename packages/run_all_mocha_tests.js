#!node
"use strict";

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const Mocha = require("mocha");

require("source-map-support").install();
require("ts-node").register({
    transpileOnly: true
});

Error.stackTraceLimit = 20;

require("mocha-clean");

async function collect_files(testFiles, testFolder) {
    for (const file of fs.readdirSync(testFolder)) {
        let f = path.join(testFolder, file);
        if (fs.lstatSync(f).isDirectory()) {
            await collect_files(testFiles, f);
        } else {
            if (file.match(/^test_.*\.ts/) && !file.match(/^test_.*\.d\.ts/)) {
                testFiles.push(f);
            } else if (file.match(/^test_.*\.js/)) {
                // make sure that there is not a TS file along side
                if (fs.existsSync(file.replace(".js", ".ts"))) {
                    console.log("warning => transpiled js file ignored : ", file);
                } else {
                    testFiles.push(f);
                }
            } else {
                //xx console.log("skipping file ",f);
            }
        }
    }
}

async function extractAllTestFiles() {
    let testFiles = [];

    const promises = [];
    for (const file of fs.readdirSync(__dirname)) {
        const testFolder = path.join(__dirname, file, "test");
        if (fs.existsSync(testFolder)) {
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
    let sourceCode = fs.readFileSync(file, "ascii");
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
} catch (err) {
    /** */
}

function checkMemoryConsumption() {
    forceGC();
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

                if (doHeapSnapshotGlobal && heapdump) heapdump.writeSnapshot("./" + heapsnapshot + ".start.heapsnapshot");
            })
            .on(EVENT_SUITE_BEGIN, (test) => {
                if (process.stdout.cursorTo && process.stdout.clearLine) {
                    process.stdout.clearLine(); // clear current text
                    process.stdout.cursorTo(0); // move cursor to beginning of line
                }
                console.log("                  " + this.indent() + chalk.yellow(test.title));
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.counter++;
                const mem = checkMemoryConsumption();
                // console.log(`The script uses approximately ${Math.round(mem * 100) / 100} MB`);
                this.memBefore = mem;
                let memInfo = mem.toPrecision(5);
                this.displayStatus(test, chalk.cyan(symbols.dot), chalk.grey(memInfo), "", "\r");
                if (doHeapSnapshot && heapdump)
                    heapdump.writeSnapshot("./" + Date.now() + ".start." + this.counter + ".heapsnapshot");

                this.old_console = console.log;
                console.log = myConsoleLog;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, (test) => {
                console.log = oldConsole;

                const color = Mocha.reporters.Base.color;
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
                    heapdump.writeSnapshot("./" + Date.now() + ".end." + this.counter + ".heapsnapshot");
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
                if (doHeapSnapshotGlobal && heapdump) heapdump.writeSnapshot("./" + heapsnapshot + ".end.heapsnapshot");
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
            const title = this.indent() + status + " " + test.title;
            const progress = this.counter.toString().padStart(4, " ") + "/" + this.total;
            process.stdout.write(mem + " " + progress + " " + title + extra + ending);
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
    let mocha = new Mocha({
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
    suite.on("pre-require", (global, file, self) => {
     //   console.log("pre-require", file);
    });
    suite.on("require", (script, file, self) => {
        /* */
    });
    suite.on("post-require", (global, file, self) => {
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

    return await new Promise((resolve) => {
        mocha.run((failures) => {
            resolve(failures);
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

    const skipped = process.env.SKIPPED ? parseInt(process.env.SKIPPED) : 0;
    const pageCount = parseInt(process.env.PAGECOUNT || "0") || 1;
    const pageSize = parseInt(process.env.PAGESIZE || "0") || 1;
    const page = process.env.TESTPAGE ? parseInt(process.env.TESTPAGE) : undefined;

    let reporter = process.env.REPORTER || "spec"; //"nyan", //"tap"
    if (process.env.NODEOPCUATESTREPORTER) {
        reporter = MyReporter;
    }
    (async () => {
        try {
            const selectedTests = await extractTestFiles({ page, pageSize, pageCount });
            const failures = await runtests({ selectedTests, reporter, skipped, filterOpts });
            process.exit(failures);
        } catch (err) {
            console.log("---------------------------------- mocha run error");
            console.log(err);
            process.exit(-1);
        }
    })();
}

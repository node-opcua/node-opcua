#!node
"use strict";

const Mocha = require("mocha");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

require("source-map-support").install();
require("ts-node").register({
    transpileOnly: true
});

Error.stackTraceLimit = Infinity;


require("mocha-clean");

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

let filterOpts = process.argv[process.argv.length - 1];

if (filterOpts.match(/run_all_mocha/)) {
    filterOpts = "";
}
if (filterOpts) {
    console.log("test filter = ", filterOpts);
}
// Instantiate a Mocha instance.
let mocha = new Mocha({
    bail: true,
    fullTrace: true,
    grep: filterOpts,
    reporter: process.env.REPORTER || "spec", //"nyan", //"tap"
    slow: 6000,
});

const doHeapSnapshot = !!process.env["HEAPSNAPSHOT"];
const doHeapSnapshotGlobal = true;

let testFiles = [];

function collect_files(testFolder) {

    for (const file of fs.readdirSync(testFolder)) {

        let f = path.join(testFolder, file);
        if (fs.lstatSync(f).isDirectory()) {
            collect_files(f);
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

for (const file of fs.readdirSync(__dirname)) {

    const testFolder = path.join(__dirname, file, "test");
    if (fs.existsSync(testFolder)) {
        collect_files(testFolder);
    }
}

testFiles = testFiles.sort();

// -------------------------------------------------
// portion
if (process.env.TESTPAGE) {

    console.log("nb files with tests : ", testFiles.length);

    const pageSize = 10;
    const testPage = parseInt(process.env.TESTPAGE);
    if (testPage == -1) {

        // display test page
        let i = 0;
        while (testFiles) {

            console.log("\n --------------------------------- Page ", i);

            const a = testFiles.slice(i * pageSize, (i + 1) * pageSize);
            if (a.length === 0) {
                return;
            }
            for (const f of a) {
                console.log("        " + f);
            }

            i++
        }

        exit(0);
    }
    testFiles = testFiles.slice(testPage * pageSize, (testPage + 1) * pageSize);

    console.log(" Testing with test page : " + testPage);
    console.log(testFiles[0]);
    console.log(testFiles[testFiles.length - 1]);
}

const suite = mocha.suite;
suite.on('pre-require', (global, file, self) => {
    //console.log("pre-require", file);
});
suite.on('require', (script, file, self) => {

});
suite.on('post-require', (global, file, self) => {
    //  console.log("post   -require", file);

});


// Add each .js file to the mocha instance
const selectedFiles = testFiles.filter((file) => {
    // Only keep the .js files
    const extension = file.substr(-3);
    return extension === ".js" || extension === ".ts";
});
for (const file of selectedFiles) {

    function test_no_leak() {
        let t = fs.readFileSync(file, "ascii");
        if (t.match("OPCUAClient")) {
            if (!t.match("Leak")) {
                console.log(" OPCUAClient without leak detection mechanism  !!!", file);
            }
        }
    }
    test_no_leak();
    mocha.addFile(file);
}

mocha.timeout(200000);
mocha.bail(true);

function forceGC() {
    if (global.gc) {
        global.gc();
    } else {
        // console.warn('No GC hook! Start your program as `node --expose-gc file.js`.');
    }
}

var heapdump = require('heapdump');

function checkMemoryConsumption() {
    forceGC();
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return used;
    //  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
}



Mocha.reporters.Base.color;

const heapsnapshot = Date.now().toString();
const oldConsole = console.log;
function myConsoleLog() {


}
const symbols = {
    ok: '✓',
    err: '✖',
    dot: '․',
    comma: ',',
    bang: '!'
}
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
                console.log('start');

                if (doHeapSnapshotGlobal)
                    heapdump.writeSnapshot('./' + heapsnapshot + '.start.heapsnapshot');
            })
            .on(EVENT_SUITE_BEGIN, test => {
                process.stdout.clearLine();  // clear current text
                process.stdout.cursorTo(0);  // move cursor to beginning of line
                console.log("                  " + this.indent() + chalk.yellow(test.title));
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, test => {
                this.counter++;
                const mem = checkMemoryConsumption();
                this.memBefore = mem;
                let memInfo = mem.toPrecision(5);
                this.displayStatus(test, chalk.cyan(symbols.dot), chalk.grey(memInfo), "", "\r");
                if (doHeapSnapshot)
                    heapdump.writeSnapshot('./' + Date.now() + '.start.' + this.counter + '.heapsnapshot');

                this.old_console = console.log;
                console.log = myConsoleLog;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, test => {

                console.log = oldConsole;

                var color = Mocha.reporters.Base.color;
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
                if (doHeapSnapshot)
                    heapdump.writeSnapshot('./' + Date.now() + '.end.' + this.counter + '.heapsnapshot');
            })
            .on(EVENT_TEST_SKIPPED, (test) => {
                console.log = oldConsole;
                this.displayStatus(test, chalk.red(symbols.bang), "     ", "", "\n");
            })
            .on(EVENT_TEST_FAIL, (test, err) => {

                console.log = oldConsole;

                this.displayStatus(test, chalk.red(symbols.fail), "     ", "", "\n");
                console.log(err);
            })
            .once(EVENT_RUN_END, () => {

                const mem = checkMemoryConsumption();
                let memInfo = mem.toPrecision(5);
                console.log(`end: ${stats.passes} / ${stats.passes + stats.failures} ok   (mem = ${memInfo} MB)`);
                console.log(`total test: ${this.total}`);
                console.log("max mem =", this.maxMem.toPrecision(5), "MB");
                if (doHeapSnapshotGlobal)
                    heapdump.writeSnapshot('./' + heapsnapshot + '.end.heapsnapshot');
            });
    }
    displayStatus(test, status, mem, extra, ending) {
        extra = extra || "";
        try {
            process.stdout.cursorTo(0);  // move cursor to beginning of line
            process.stdout.clearLine();  // clear current text

            process.stdout.cursorTo(0);  // move cursor to beginning of line
            const title = this.indent() + status + " " + test.title;
            const progress = this.counter.toString().padStart(4, " ") + "/" + this.total;
            process.stdout.write(mem + " " + progress + " " + title + extra + ending);
            return mem;
        }
        catch (err) {
            console.log(err);
        }
    }
    indent() {
        return Array(this._indents).join('  ');
    }

    increaseIndent() {
        this._indents++;
    }

    decreaseIndent() {
        this._indents--;
    }
}
mocha.reporter(MyReporter);
// Run the tests.
mocha.run((failures) => {
    process.exit(failures);  // exit with non-zero status if there were failures
});


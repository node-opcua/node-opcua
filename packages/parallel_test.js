const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const readline = require("readline");
const os = require("os");

require("should");

const chalk = require("chalk");

const Mocha = require("mocha");

function durationToString(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 3600);
    const days = Math.floor(hours / 24);
    const a = (n) => n.toString().padStart(2, "0");
    const b = (n) => n.toString().padStart(3, "0");
    return `${a(minutes % 60)}:${a(seconds % 60)}.${b(milliseconds % 1000)}`;
}

const { runtests, extractAllTestFiles, extractPageTest } = require("./run_all_mocha_tests.js");

const colorWheel = [
    chalk.red,
    chalk.green,
    chalk.yellow,
    chalk.blue,
    chalk.magenta,
    chalk.cyan,
    chalk.white,
    chalk.gray,
    chalk.bgRed,
    chalk.bgGreen,
    chalk.bgYellow,
    chalk.bgBlue,
    chalk.bgMagenta,
    chalk.bgCyan,
    chalk.bgGray
];
const pageCount = 1;
const pageSize = 1;

const TEST_FILE_STARTED = "TEST_FILE_STARTED";
const TEST_FILE_COMPLETED = "TEST_FILE_COMPLETED";
const TEST_FILE_COMPILATION_ERROR = "TEST_FILE_COMPILATION_ERROR";
const runningPages = new Set();

const failingTestFilename = [];
const durationsPerTestFile = {};
let testFiles = [];

let testCounter = 0;
let fileStarted = 0;
let fileCounter = 0;
let fileMax = 0;
function collectDuration(test) {
    testCounter++;
    const { file } = test;
    if (!durationsPerTestFile[file]) {
        durationsPerTestFile[file] = test.duration || 0;
    }
    durationsPerTestFile[file] = durationsPerTestFile[file] + test.duration;
}

async function runTest({ page, selectedTests }) {
    function w(n, w) {
        return n.toString().padStart(w, " ");
    }
    function prefix() {
        const a = [...runningPages].join(", ").padEnd(40);
        // const prefix = colorWheel[page % colorWheel.length]("page ", page.toString().padEnd(4) + a);
        const prefix = colorWheel[page % colorWheel.length](
            `${w(fileCounter, 3)}+${w(fileStarted - fileCounter, 2)}/${w(fileMax, 3)} ${w(testCounter, 4)} -  ${w(
                Math.ceil((fileCounter / fileMax) * 100),
                3
            )}% `
        );
        return prefix;
    }
    const result = new Promise((resolve, reject) => {
        runningPages.add(page);
        const worker = new Worker(__filename /*new URL(import.meta.url)*/, {
            workerData: { page, selectedTests },
            env: {
                ...process.env
            }
        });
        worker.on("message", (message) => {
            const { type, test, args } = message;
            // args && console.log(prefix(), ...args);
            switch (type) {
                case TEST_FILE_STARTED:
                    fileStarted++;
                    break;
                case TEST_FILE_COMPLETED:
                    fileCounter++;
                    break;
                case TEST_FILE_COMPILATION_ERROR:
                    break;
                case EVENT_TEST_BEGIN:
                    break;
                case EVENT_TEST_SKIPPED:
                    collectDuration(test);
                    break;
                case EVENT_TEST_FAIL:
                    {
                        collectDuration(test);
                        const { duration, title, file, error, timedOut, state, stats, output } = test;
                        failingTestFilename.push(file.replace(__dirname, ""));
                        const d = durationToString(duration);

                        console.log(prefix(), d, chalk.red(title)); // JSON.stringify(test, null, ""));
                        console.log(prefix(), file);
                        console.log(error);

                        console.log("-----------------------------------------------------------------------------");
                        for (const l of output) {
                            console.log(prefix(), ...l);
                        }
                        console.log("-----------------------------------------------------------------------------");
                        epilogue();
                        process.exit(1);
                    }
                    break;
                case EVENT_TEST_PASS:
                    {
                        collectDuration(test);
                        const { duration, title, file, error, timedOut, state, stats } = test;

                        const d = durationToString(duration);
                        console.log(prefix(), d, chalk.green(title)); // JSON.stringify(test, null, ""));
                    }
                    break;
            }
        });

        worker.on("error", reject);
        worker.on("exit", (code) => {
            runningPages.delete(page);
            if (code !== 0) reject(new Error(`Worker ${page} stopped with exit code ${code}`));
            resolve();
        });
    });

    return result;
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
        const stats = runner.stats;
        this.total = runner.total;
        const outputLines = [];
        runner
            .once(EVENT_RUN_BEGIN, () => {
                // console.log("start");
            })
            .on(EVENT_SUITE_BEGIN, (test) => {
                // console.log("  " + this.indent() + chalk.yellow(test.title), test.fullTitle());
                this.increaseIndent();
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.oldConsoleLog = console.log;
                this.outputLines = [];
                console.log = (...args) => {
                    /** */
                    this.outputLines.push(args);
                };
                console.log("  " + this.indent() + chalk.cyan(test.title), chalk.magenta(test.file));

                this.counter++;
            })
            .on(EVENT_SUITE_END, () => {
                this.decreaseIndent();
            })
            .on(EVENT_TEST_PASS, (test) => {
                console.log = this.oldConsoleLog;
                /** */
                console.log("  " + chalk.yellow(test.fullTitle()));
                // console.log("  " + this.indent() + chalk.green(test.title));
                const { duration, file, error, timedOut, state, stats, title } = test;
                const output = this.outputLines;
                const titlePath = test.titlePath();
                parentPort.postMessage({
                    type: EVENT_TEST_PASS,
                    test: { duration, file, error, timedOut, state, stats, title, output, titlePath }
                });
            })
            .on(EVENT_TEST_SKIPPED, (test) => {
                console.log("  " + chalk.yellow(test.fullTitle()));
                console.log = this.oldConsoleLog;
                console.log("  " + chalk.yellow(test.fullTitle()));
                /** */
                const { duration, file, error, timedOut, state, stats, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                parentPort.postMessage({
                    type: EVENT_TEST_SKIPPED,
                    test: { duration, file, error, timedOut, state, stats, title, output, titlePath }
                });
                // console.log("  " + this.indent() + chalk.yellow(test.title));
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                console.log = this.oldConsoleLog;
                console.log(err);
                console.log("  " + chalk.red(test.fullTitle()));
                console.log(test.file);
                const { duration, file, error, timedOut, state, stats, title } = test;
                const titlePath = test.titlePath();
                const output = this.outputLines;
                parentPort.postMessage({
                    type: EVENT_TEST_FAIL,
                    test: { duration, file, error: err, timedOut, state, stats, title, output, titlePath }
                });
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

async function runTestAndContinue(data) {
    if (data.index >= data.testFiles.length) {
        return;
    }
    try {
        data.index++;
        const page = data.index;
        const selectedTests = await extractPageTest(data.testFiles, { page, pageSize: 1, pageCount: 1 });
        if (selectedTests.length === 0) {
            data.pageCount = data.index;
            return;
        }
        await runTest({ page, selectedTests });
    } catch (err) {
        // stop now
        data.pageCount = data.index;
        console.error(err);
        return;
    }
    await runTestAndContinue(data);
}

const t1 = Date.now();
function epilogue() {
    const t2 = Date.now();
    console.log("Duration     : ", durationToString(t2 - t1));
    console.log("test count   : ", testCounter);
    console.log("Failing tests: ");
    console.log(failingTestFilename.join("\n"));
    const testByDuration = [...Object.entries(durationsPerTestFile)].sort(
        ([file1, duration1], [file2, duration2]) => duration2 - duration1
    );
    console.log("Longest tests:");
    console.log(
        testByDuration
            .slice(0, 30)
            .map(([file, duration]) => `${durationToString(duration)}: ${file}`)
            .join("\n")
    );
    console.log("-------------------------------------------------------------------------------");
    const runningTests = [...runningPages].map((i) => testFiles[i]);
    console.log(`running tests: ${runningTests.length}`);
    console.log(runningTests.join("\n"));
}

if (isMainThread) {
    (async () => {
        testFiles = await extractAllTestFiles();

        if (process.stdin && process.stdin.setRawMode) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.prompt(true);

            rl.setPrompt(`
              
                help:
                -----
            
                CTRL+C : gracefully shutdown the client    
                l      : list running tests
            
                press a key to continue:
            
            `);

            readline.emitKeypressEvents(process.stdin, rl);
            process.stdin.setRawMode(true);
            process.stdin.on("keypress", async (str, key) => {
                console.log(`You pressed the "${str}" key`);

                if (key.ctrl && key.name === "C") {
                    process.exit(0);
                }
                if (key.name === "l") {
                    const runningTests = [...runningPages].map((i) => testFiles[i]);
                    console.log(`running tests: ${runningTests.length}`);
                    console.log(runningTests.join("\n"));
                }
            });
        }

        const data = {
            index: 0,
            pageCount: 200,
            testFiles
        };
        fileMax = testFiles.length;
        const promises = [];
        const cpuCount = Math.max(os.cpus().length * 0.8, 2);
        for (let i = 0; i < cpuCount; i++) {
            promises.push(runTestAndContinue(data));
        }
        await Promise.all(promises);

        epilogue();
        process.exit(0);
    })();
} else {
    const { page, selectedTests } = workerData;

    console.log = (...args) => {
        try {
            parentPort.postMessage({ type: "LOG", page, args });
        } catch (err) {
            console.log(err);
        }
    };
    console.warn = (...args) => {
        try {
            parentPort.postMessage({ type: "LOG", page, args });
        } catch (err) {
            console.log(err);
        }
    };
    (async () => {
        // console.log("Worker started", page, selectedTests.length);
        for (const file of selectedTests) {
            parentPort.postMessage({ type: "TEST_FILE_STARTED", file });
        }
        const reporter = ParallelMochaReporter;
        const failures = await runtests({ reporter, dryRun: false, filterOpts: "", selectedTests });
        for (const file of selectedTests) {
            parentPort.postMessage({ type: "TEST_FILE_COMPLETED", file });
        }
    })();
}

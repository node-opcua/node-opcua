#!/usr/bin/env node
const { Worker, isMainThread } = require("node:worker_threads");
const readline = require("node:readline");
const os = require("node:os");

/**
 * A malformed value must not silently disable the run: parseInt("x") is NaN, and
 * NaN propagates through Math.round/Math.max all the way to the worker loop,
 * which then spawns nothing and exits as if every test had passed.
 */
function envNumber(name, defaultValue, parse) {
    const raw = process.env[name];
    if (raw === undefined || raw === "") {
        return defaultValue;
    }
    const value = parse(raw);
    if (!Number.isFinite(value) || value <= 0) {
        // no chalk here: this runs before the require() block below
        console.warn(`[parallel_test] ignoring ${name}=${raw} - not a positive number, using ${defaultValue}`);
        return defaultValue;
    }
    return value;
}

const CPU = envNumber("CPU", 0, (v) => parseInt(v, 10));

const MIN_WORKER_COUNT = envNumber("MIN_WORKER_COUNT", 5, (v) => parseInt(v, 10));

const FACTOR = envNumber("CPU_FORMULA_FACTOR", 0.9, parseFloat);

const testWatchDogTimeout = process.env.PING ? parseInt(process.env.PING) : 10 * 60 * 1000;

// Disable chokidar file-system watchers in CertificateManager during
// parallel test runs. Each OPCUAServer creates 5 watchers; with N
// worker threads that quickly exhausts the libuv thread-pool (default
// UV_THREADPOOL_SIZE=4), starving dns.lookup and socket operations.
process.env.OPCUA_PKI_DISABLE_FILE_WATCHERS = "true";

require("should");

// .default: chalk 6 is ESM-only, so require() hands back the module namespace
// object rather than the instance, and every chalk.<style>() would be undefined.
const chalk = require("chalk").default;

const { Mocha } = require("mocha");
const commandLineArgs = require("command-line-args");
// Import git-aware module
let gitAwareAvailable = false;
let hasChanges, analyzeChanges, findRepoRoot, getAllPackages;
try { ({ hasChanges, analyzeChanges, findRepoRoot, getAllPackages } = require("./git_aware")); gitAwareAvailable = true; } catch (err) {}

function durationToString(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const a = (n) => n.toString().padStart(2, "0");
    const b = (n) => n.toString().padStart(3, "0");
    return `${a(minutes % 60)}:${a(seconds % 60)}.${b(milliseconds % 1000)}`;
}

/** hh:mm:ss - for the wall clock of the whole run, which routinely passes the hour */
function elapsedToString(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const a = (n) => n.toString().padStart(2, "0");
    return `${a(Math.floor(seconds / 3600))}:${a(Math.floor(seconds / 60) % 60)}:${a(seconds % 60)}`;
}

/**
 * coarse "45 s" / "12 min" / "1 h 05 min": the estimate is extrapolated from the
 * completed test files, so a to-the-second rendering would only look precise.
 */
function etaToString(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        return "--";
    }
    const seconds = Math.round(milliseconds / 1000);
    if (seconds < 90) {
        return `${seconds} s`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 90) {
        return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${(minutes % 60).toString().padStart(2, "0")} min`;
}

const CPU_BARS_HORIZONTAL = "▏▎▍▌▋▊▉█";
const CPU_BARS = CPU_BARS_HORIZONTAL;
const CPU_SAMPLE_INTERVAL = 500;
let cpuLoad = 0;
let cpuSample = null;
let cpuSampledAt = 0;

/**
 * one-character CPU gauge, averaged over all cores.
 * Sampled lazily (the progress line is printed far more often than every 500ms)
 * and from the deltas of os.cpus() times, so no extra timer is kept alive - an
 * unref'd one would still be a handle for the leak detector to trip over.
 */
function cpuBar() {
    const now = Date.now();
    if (now - cpuSampledAt >= CPU_SAMPLE_INTERVAL) {
        let idle = 0;
        let total = 0;
        for (const cpu of os.cpus()) {
            for (const time of Object.values(cpu.times)) {
                total += time;
            }
            idle += cpu.times.idle;
        }
        if (cpuSample) {
            const dTotal = total - cpuSample.total;
            const dIdle = idle - cpuSample.idle;
            if (dTotal > 0) {
                cpuLoad = Math.min(1, Math.max(0, 1 - dIdle / dTotal));
            }
        }
        cpuSample = { idle, total };
        cpuSampledAt = now;
    }
    const bar = CPU_BARS[Math.min(CPU_BARS.length - 1, Math.floor(cpuLoad * CPU_BARS.length))];
    const color = cpuLoad < 0.5 ? chalk.green : cpuLoad < 0.85 ? chalk.yellow : chalk.red;
    return color(bar);
}

/** elapsed wall clock + ETA, extrapolated from the fraction of test files completed */
function clock() {
    const elapsed = Date.now() - t1;
    const eta = estimateEtaMs();
    return `${cpuBar()}${chalk.gray(` ${elapsedToString(elapsed)} ETA ${etaToString(eta).padEnd(9)}`)}`;
}

const { extractAllTestFiles, extractPageTest } = require("./discover.js");
const { TerminalScreen } = require("./terminal_screen.js");

/**
 * Two-window TTY layout (scroll window + fixed footer), created in the main
 * thread once the run starts. See terminal_screen.js for the cursor invariant.
 * @type {TerminalScreen | null}
 */
let screen = null;

/** page -> { file, startedAt } for the "running" footer line */
const runningFiles = new Map();

/** console.log without the stray leading space an empty prefix() used to add */
function logLine(...parts) {
    console.log(...parts.filter((p) => p !== ""));
}

// Helper function for padding
function w(n, width) {
    return n.toString().padStart(width, " ");
}


// ---------------------------------------------------------------------------
// ETA
//
// The old estimate was  (now - t1) / filesDone * filesLeft , which is wrong in
// three ways for this suite:
//   - t1 is taken at module load, so file discovery, cache hashing and git
//     analysis count as test time;
//   - test files are sorted alphabetically and their cost ranges from a few ms
//     to several minutes (end2end), so "average per file" swings wildly;
//   - a file that has been running for 4 minutes counts as zero progress.
//
// Now: each file's wall time is measured (STARTED -> COMPLETED) and kept in
// .parallel_test_durations.json between runs. Remaining work is the expected
// time of the files not started yet plus what is left of the running ones,
// spread over the workers, and never less than the longest running residual.
// Expectations are rescaled by how fast this run is compared to history, and
// files never seen before are priced at the average.
// ---------------------------------------------------------------------------
/** root directory being tested; set from --root (default cwd) after arg parsing */
let ROOT = process.cwd();
let DURATIONS_FILE = require("node:path").join(ROOT, ".parallel_test_durations.json");
let durationHistory = {};
function loadDurationHistory() {
    try {
        durationHistory = JSON.parse(require("node:fs").readFileSync(DURATIONS_FILE, "utf8")) || {};
    } catch (_err) {
        durationHistory = {};
    }
}
/** file -> wall-clock ms measured during this run */
const fileWallTime = {};
/** files whose STARTED message has been seen */
const startedFiles = new Set();
let workerCount = 1;
let runStartedAt = 0;

function saveDurationHistory() {
    if (Object.keys(fileWallTime).length === 0) {
        return;
    }
    try {
        require("node:fs").writeFileSync(DURATIONS_FILE, JSON.stringify({ ...durationHistory, ...fileWallTime }, null, 1));
    } catch (_err) {
        /* best effort: a read-only checkout just means no history next time */
    }
}

function mean(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

/** @returns {number} ms, or Infinity while there is nothing to extrapolate from */
function estimateEtaMs() {
    if (!runStartedAt || fileMax === 0) {
        return Number.POSITIVE_INFINITY;
    }
    if (fileCounter >= fileMax) {
        return 0;
    }
    const now = Date.now();
    const doneFiles = Object.keys(fileWallTime);

    // speed of this run vs. history, on the files we can compare (clamped)
    let speed = 1;
    const comparable = doneFiles.filter((f) => durationHistory[f] > 0);
    if (comparable.length >= 3) {
        const actual = comparable.reduce((a, f) => a + fileWallTime[f], 0);
        const expected = comparable.reduce((a, f) => a + durationHistory[f], 0);
        speed = Math.min(3, Math.max(1 / 3, actual / expected));
    }

    // price for a file with no history
    let unknownCost = mean(doneFiles.map((f) => fileWallTime[f]));
    if (!Number.isFinite(unknownCost)) {
        unknownCost = mean(Object.values(durationHistory).filter((v) => v > 0)) * speed;
    }
    const expectedFor = (f) => (durationHistory[f] > 0 ? durationHistory[f] * speed : unknownCost);

    let remaining = 0;
    let longestResidual = 0;
    let unpriced = false;
    for (const f of testFiles) {
        if (fileWallTime[f] !== undefined) continue;
        const cost = expectedFor(f);
        if (!Number.isFinite(cost)) {
            unpriced = true;
            continue;
        }
        if (startedFiles.has(f)) {
            const running = [...runningFiles.values()].find((r) => r.file === f);
            const spent = running ? now - running.startedAt : 0;
            // a file past its expected time is assumed to be nearly done, not negative
            const residual = Math.max(cost - spent, Math.min(cost, 5000) * 0.1);
            remaining += residual;
            longestResidual = Math.max(longestResidual, residual);
        } else {
            remaining += cost;
            // a file not started yet still needs its full time once it gets a worker
            longestResidual = Math.max(longestResidual, cost);
        }
    }
    if (unpriced && remaining === 0) {
        return Number.POSITIVE_INFINITY; // first run, nothing finished yet: show "--"
    }
    return Math.max(remaining / Math.max(1, workerCount), longestResidual);
}

/**
 * Get the progress prefix for CI mode (ETA at the beginning)
 * @returns {string} Progress prefix for CI
 */
function getProgressPrefix() {
    if (!argv || argv.verbose || !usePrefixProgress) {
        return "";
    }
    
    const percent = Math.ceil((fileCounter / fileMax) * 100);
    const eta = etaToString(estimateEtaMs());
    const cpuBarChar = cpuBar();

    // Compact format for CI: ETA at front, percentage
    const prefix = chalk.gray(`[ETA ${eta} ${w(percent, 3)}% ${cpuBarChar}]`);
    // Track the last prefix for overwriting at the end
    lastETALinePrefix = prefix;
    lastETALineLength = prefix.length;
    return prefix;
}

/**
 * Render progress line for TTY mode (bottom line)
 * Uses ANSI escape codes to maintain a fixed footer line
 * @param {boolean} force - Force redraw even if same as last
 */
function renderProgress(force = false) {
    if (!argv || !argv.compact || !useBottomProgress) {
        // Not in compact mode or not in TTY mode
        return;
    }
    
    const percent = Math.ceil((fileCounter / fileMax) * 100);
    // hh:mm:ss: mm:ss.mmm wrapped back to 00 after the first hour
    const elapsed = elapsedToString(Date.now() - t1);
    const eta = etaToString(estimateEtaMs());

    // CPU bar
    const cpuBarChar = cpuBar();
    
    // Progress bar (30 chars wide)
    const progressBarLength = 30;
    const completed = Math.min(progressBarLength, Math.floor((fileCounter / fileMax) * progressBarLength));
    const remaining = progressBarLength - completed;
    const progressBar = chalk.green(CPU_BARS[CPU_BARS.length - 1].repeat(completed)) + 
                       chalk.gray(CPU_BARS[0].repeat(remaining));
    
    // Build progress line
    const progressLine = chalk.white(
        `${cpuBarChar} ${elapsed} |${progressBar}| ${w(fileCounter, 4)}/${w(fileMax, 4)} files | ` +
        `${w(testCounter, 5)} tests | ${w(percent, 3)}% | ETA ${eta}`
    );
    
    screen && screen.setFooter([progressLine, runningLine()]);
}

/** second footer line: files in flight, longest running first (hung tests stand out) */
function runningLine() {
    const now = Date.now();
    const items = [...runningFiles.values()]
        .sort((a, b) => a.startedAt - b.startedAt)
        .map(({ file, startedAt }) => {
            const secs = Math.round((now - startedAt) / 1000);
            const color = secs > 120 ? chalk.red : secs > 30 ? chalk.yellow : chalk.gray;
            return color(`${file.split(/[\\/]/).pop()} ${secs}s`);
        });
    return chalk.gray(`running ${items.length}: `) + items.join(chalk.gray(" | "));
}


const TEST_FILE_STARTED = "TEST_FILE_STARTED";
const TEST_FILE_COMPLETED = "TEST_FILE_COMPLETED";
const TEST_FILE_COMPILATION_ERROR = "TEST_FILE_COMPILATION_ERROR";
const runningPages = new Set();

const failingTestFilename = [];
const failingTests = {};
const outputFor = {};

const durationsPerTestFile = {};
let testFiles = [];

let testCounter = 0;
let fileStarted = 0;
let fileCounter = 0;
let fileMax = 0;
let filesSkippedByResume = 0;
let filesSkippedByCache = 0;
let originalTestFileCount = 0;
let filesSkippedByGitAware = 0;
let filesSkippedByOnlyFail = 0;
let failingTestList = [];
let globalTestCache = null;
let argv = null; // Will be set in main thread
const workers = {};

// Progress display state
let lastETALinePrefix = "";  // Track last ETA prefix in CI mode for overwriting
let lastETALineLength = 0;

// Detect environment
let isTTY = process.stdout.isTTY === true;
let isCI = process.env.CI === "true" || 
           process.env.GITHUB_ACTIONS === "true" || 
           process.env.GITLAB_CI === "true" || 
           process.env.CONTINUOUS_INTEGRATION === "true" ||
           process.env.TERM === "dumb" || 
           !process.stdout.isTTY;

// Allow override via environment variables (for testing)
if (process.env.FORCE_TTY === "1") {
    isTTY = true;
    isCI = false;
}
if (process.env.FORCE_CI === "1") {
    isTTY = false;
    isCI = true;
}

// In CI mode, we can't use cursor control, so use line-prefix mode
// In TTY mode, we can use cursor control for bottom-line progress
const useBottomProgress = isTTY && !isCI;
const usePrefixProgress = !isTTY || isCI;
function collectDuration(test) {
    testCounter++;
    const { file } = test;
    durationsPerTestFile[file] = (durationsPerTestFile[file] || 0) + (test.duration || 0);
}

async function runTest({ page, selectedTests, g }) {
    
    function prefix() {
        // In compact mode with bottom progress, no prefix needed
        if (argv && argv.compact && useBottomProgress) {
            return "";
        }
        
        // In CI mode (prefix progress), use the progress prefix
        if (argv && argv.compact && usePrefixProgress) {
            const p = getProgressPrefix();
            return p ? p.padEnd(30) : "";
        }
        
        // Verbose mode: old behavior with full prefix
        const percent = Math.ceil((fileCounter / fileMax) * 100);

        // Use clock() for CPU bar + elapsed + ETA
        const clockStr = clock();
        
        // Progress bar showing file completion
        const progressBarLength = 20;
        const completed = Math.min(progressBarLength, Math.floor((fileCounter / fileMax) * progressBarLength));
        const remaining = progressBarLength - completed;
        const progressBar = chalk.green(CPU_BARS[CPU_BARS.length - 1].repeat(completed)) + 
                           chalk.gray(CPU_BARS[0].repeat(remaining));
        
        const prefixStr = chalk.white(
            `${clockStr} | ${progressBar} | ${w(fileCounter, 3)}/${w(fileMax, 3)} files | ${w(testCounter, 5)} tests | ${w(percent, 3)}%`
        ).padEnd(120);
        return prefixStr;
    }
    const result = new Promise((resolve, reject) => {
        runningPages.add(page);
        const worker = new Worker(require("node:path").join(__dirname, "worker.js"), {
            workerData: { page, selectedTests, g },
            env: {
                ...process.env
            },
            // capture instead of letting Node pipe raw worker output onto the
            // terminal: anything a test writes (console.error, debug, stdout.write)
            // goes to the per-file log shown on failure / watchdog
            stdout: true,
            stderr: true
        });
        const capture = (tag) => (chunk) => {
            const current = runningFiles.get(page);
            const file = current ? current.file : selectedTests[0];
            outputFor[file] = outputFor[file] || [];
            for (const line of chunk.toString().split("\n")) {
                if (line.length) outputFor[file].push(`${tag}       ${line}`);
            }
        };
        worker.stdout.on("data", capture("O"));
        worker.stderr.on("data", capture("E"));
        // Track worker for cleanup
        workers[page] = worker;
        worker.on("message", (message) => {
            const { type, file, test, line } = message;
            // args && logLine(prefix(), ...args);
            switch (type) {
                case "LOG":
                    outputFor[file].push(line); //util.format.apply(args));
                    break;
                case TEST_FILE_STARTED:
                    outputFor[file] = outputFor[file] || [];
                    runningFiles.set(page, { file, startedAt: Date.now() });
                    startedFiles.add(file);
                    fileStarted++;
                    break;
                case TEST_FILE_COMPLETED:
                    fileCounter++;
                    outputFor[file] = [];
                    {
                        const running = runningFiles.get(page);
                        if (running && running.file === file) {
                            fileWallTime[file] = Date.now() - running.startedAt;
                        }
                    }
                    runningFiles.delete(page);
                    if (argv && argv.compact) {
                        // Force re-render progress line at bottom
                        renderProgress(true);
                    }
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
                        const { duration, title, file, error, output, titlePath } = test;
                        failingTestFilename.push(file.replace(ROOT, ""));
                        failingTests[file] = titlePath;

                        const d = durationToString(duration);
                        
                        // Determine status marker
                        const statusMarker = globalTestCache && globalTestCache.hasFilePassed(file) ? 
                            chalk.cyan("[CACHED]") : chalk.red("[FAIL]");

                        logLine(prefix(), chalk.red(title), chalk.white(` ${statusMarker}`));
                        logLine(prefix(), chalk.gray(`  ${d}  ${file}`));
                        logLine(prefix(), chalk.red(`  ${error}`));

                        console.log(chalk.gray("-".repeat(70)));
                        for (const l of output) {
                            for (const ll of l.split("\n")) {
                                logLine(prefix(), chalk.redBright(ll));
                            }
                        }
                        console.log("-----------------------------------------------------------------------------");
                        // Show one-line summary for early exit, but not for noStop mode (will be shown at end)
                        epilogue(argv.noStop ? false : true);
                        // Save checkpoint for failed test
                        if (globalTestCache) {
                            globalTestCache.markFileFailed(file, titlePath || title, error || "Test failed");
                        }
                        // In non-stop mode, collect failing test and continue
                        if (argv.noStop) {
                            failingTestList.push({
                                file,
                                test: titlePath || title,
                                error: error || "Test failed",
                                timestamp: Date.now()
                            });
                            console.log(chalk.yellow("  [FAILED but continuing - noStop mode] "));
                            
                            // Save to cache immediately to prevent data loss on crash
                            if (globalTestCache) {
                                globalTestCache.saveFailingTests(failingTestList);
                            }
                        } else {
                            process.exit(1);
                        }
                    }
                    break;
                case EVENT_TEST_PASS:
                    {
                        collectDuration(test);
                        const { duration, title, file } = test;

                        const d = durationToString(duration);
                        
                        // Determine status marker
                        const wasCached = globalTestCache && globalTestCache.hasFilePassed(file);
                        const statusMarker = wasCached ? chalk.cyan("[CACHED]") : chalk.green("[PASS]");

                        logLine(prefix(), chalk.green(title), chalk.white(` ${statusMarker}`));
                        logLine(prefix(), chalk.gray(`  ${d}  ${file}`));
                        
                        // Mark file as passed in cache
                        if (globalTestCache) {
                            globalTestCache.markFilePassed(file, title);
                        }
                        
                        // Progress updates are handled by timer, not after each test
                    }
                    break;
            }
        });

        worker.on("error", reject);
        worker.on("exit", (code) => {
            runningPages.delete(page);
            runningFiles.delete(page);
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

async function runTestAndContinue(data) {
    if (data.index >= data.testFiles.length) {
        return;
    }
    try {
        const page = data.index++;
        const g = data.g;
        const selectedTests = await extractPageTest(data.testFiles, { page, pageSize: 1, pageCount: 1 });
        if (selectedTests.length === 0) {
            data.pageCount = data.index;
            return;
        }
        await runTest({ page, selectedTests, g });
    } catch (err) {
        // stop now
        data.pageCount = data.index;
        console.error(err);
        return;
    }
    await runTestAndContinue(data);
}

const t1 = Date.now();
function reportFailures() {
    if (failingTestList.length > 0) {
        console.log();
        console.log(chalk.bgRed.white(" ═══════════════════════════════════════════════════════════ "));
        console.log(chalk.bgRed.white("                        FAILED TESTS                                    "));
        console.log(chalk.bgRed.white(" ═══════════════════════════════════════════════════════════ "));
        console.log();
        console.log(chalk.red("  Total failing tests: " + failingTestList.length));
        console.log();
        for (let i = 0; i < failingTestList.length; i++) {
            const fail = failingTestList[i];
            console.log(chalk.white((i + 1) + ". " + fail.file));
            console.log(chalk.white("   Test: " + fail.test));
            console.log(chalk.red("   Error: " + fail.error));
            console.log();
        }
        console.log(chalk.cyan("  To re-run only failing tests:"));
        console.log("    " + chalk.yellow("parallel-runner --onlyFail"));
        
        // Save failing tests to cache for --onlyFail mode
        if (globalTestCache) {
            globalTestCache.saveFailingTests(failingTestList);
        }
        console.log();
    }
}

function epilogue(isFinal = true) {
    const t2 = Date.now();
    
    // ==========================================
    // OVERWRITE/REPLACE LAST PROGRESS WITH SUMMARY
    // Only show the one-line summary on final call (not after each failure in noStop mode)
    // ==========================================
    
    // In CI mode: print final summary on new line WITHOUT ETA prefix
    // This makes it stand out as the final, clear message
    if (isFinal && argv && argv.compact && usePrefixProgress) {
        const failCount = failingTestFilename.length;
        let summaryMessage;
        if (failCount === 0) {
            summaryMessage = chalk.bgGreen.white(" ✓ ALL TESTS PASSED ") + chalk.green(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        } else {
            summaryMessage = chalk.bgRed.white(` ✗ ${failCount} TEST${failCount > 1 ? 'S' : ''} FAILED `) + chalk.red(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        }
        // Print on new line - stands out without ETA prefix
        console.log();
        console.log(summaryMessage);
        lastETALinePrefix = "";
    }
    
    // In TTY mode: overwrite the progress line with final status
    if (isFinal && argv && argv.compact && useBottomProgress) {
        const failCount = failingTestFilename.length;
        let summaryMessage;
        if (failCount === 0) {
            summaryMessage = chalk.bgGreen.white(" ✓ ALL TESTS PASSED ") + chalk.green(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        } else {
            summaryMessage = chalk.bgRed.white(` ✗ ${failCount} TEST${failCount > 1 ? 'S' : ''} FAILED `) + chalk.red(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        }
        // drop the footer and print the summary where the scroll window ended
        if (screen) {
            screen.stop(summaryMessage);
        } else {
            console.log(summaryMessage);
        }
    }
    
    // In verbose mode: also show a clear final summary
    if (isFinal && argv && argv.verbose) {
        const failCount = failingTestFilename.length;
        let summaryMessage;
        if (failCount === 0) {
            summaryMessage = chalk.bgGreen.white(" ✓ ALL TESTS PASSED ") + chalk.green(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        } else {
            summaryMessage = chalk.bgRed.white(` ✗ ${failCount} TEST${failCount > 1 ? 'S' : ''} FAILED `) + chalk.red(` (${testCounter} tests, ${durationToString(t2 - t1)})`);
        }
        console.log();
        console.log(summaryMessage);
    }
    
    // ==========================================
    // SYNTHETIC REPORT
    // ==========================================
    console.log();
    console.log(chalk.bgBlue.white(" ═══════════════════════════════════════════════════════════ "));
    console.log(chalk.bgBlue.white("                      TEST RUN SUMMARY                                 "));
    console.log(chalk.bgBlue.white(" ═══════════════════════════════════════════════════════════ "));
    console.log();
    
    // Use the skip counters tracked during the run (module-level), NOT a recount
    // from the cache file: in CI the cache is restored from a previous job and its
    // entries may be stale for this checkout, so getPassedCount() can disagree
    // with what was actually skipped (e.g. "Skipped 733" while 741 files ran).
    const filesActuallyRun = fileCounter;
    const totalSkipped = filesSkippedByCache + filesSkippedByResume + filesSkippedByGitAware + filesSkippedByOnlyFail;
    // Total files = files skipped + files actually run (== originalTestFileCount)
    const totalFiles = Math.min(originalTestFileCount, totalSkipped + filesActuallyRun);
    
    console.log(chalk.white("  Summary:"));
    console.log(chalk.white(`    Total files:     ${chalk.cyan(totalFiles)}`));
    if (totalSkipped > 0) {
        console.log(chalk.white(`    Skipped:         ${chalk.green(totalSkipped)} ${chalk.gray(`(saved ${totalSkipped} file executions)`)}`));
        if (filesSkippedByResume > 0) console.log(chalk.white(`      - Resume:      ${chalk.green(filesSkippedByResume)} files`));
        if (filesSkippedByCache > 0) console.log(chalk.white(`      - Cached:      ${chalk.green(filesSkippedByCache)} files`));
        if (filesSkippedByGitAware > 0) console.log(chalk.white(`      - Git-aware:   ${chalk.green(filesSkippedByGitAware)} files`));
        if (filesSkippedByOnlyFail > 0) console.log(chalk.white(`      - OnlyFail:    ${chalk.green(filesSkippedByOnlyFail)} files`));
    }
    console.log(chalk.white(`    Actually run:    ${chalk.cyan(filesActuallyRun)} files`));
    console.log(chalk.white(`    Tests executed: ${chalk.cyan(testCounter)} tests`));
    console.log(chalk.white(`    Failures:        ${failingTestFilename.length > 0 ? chalk.red(failingTestFilename.length) : chalk.green("0")} tests`));
    console.log();
    console.log(chalk.white(`  Duration: ${chalk.cyan(durationToString(t2 - t1))}`));
    console.log();
    
    // ==========================================
    // AUTOMATIC CHECKPOINT RESET WHEN ALL TESTS PASS
    // (Keep cache for performance, but clear checkpoint for fresh start)
    // ==========================================
    if (failingTestFilename.length === 0 && filesActuallyRun > 0) {
        console.log(chalk.bgGreen.white(" ═══════════════════════════════════════════════════════════ "));
        console.log(chalk.bgGreen.white("  ✓ ALL TESTS PASSED                                            "));
        console.log(chalk.bgGreen.white(" ═══════════════════════════════════════════════════════════ "));
        console.log();
        
        if (globalTestCache) {
            // Clear checkpoint for fresh start, but KEEP cache for performance
            globalTestCache.clearCheckpoint();
            console.log(chalk.green("  ✓ Checkpoint cleared - next run will start from beginning"));
            console.log(chalk.green("  ✓ Cache preserved - passed tests will be skipped"));
        }
    } else if (failingTestFilename.length > 0) {
        console.log(chalk.bgYellow.white(" ═══════════════════════════════════════════════════════════ "));
        console.log(chalk.bgYellow.white("  ⚠ SOME TESTS FAILED                                           "));
        console.log(chalk.bgYellow.white(" ═══════════════════════════════════════════════════════════ "));
        console.log();
        if (globalTestCache) {
            console.log(chalk.yellow("  ✓ Cache preserved - next run will resume from last failing test"));
        }
    }
    console.log();
    
    // ==========================================
    // DETAILED FAILURE INFORMATION
    // ==========================================
    if (failingTestFilename.length > 0) {
        console.log();
        console.log(chalk.bgRed.white(" "));
        console.log(chalk.bgRed.white("  Failing Tests:"));
        console.log(chalk.bgRed.white(" "));
        for (let i = 0; i < failingTestList.length; i++) {
            const fail = failingTestList[i];
            console.log(chalk.red(`  ${i + 1}. ${fail.file}`));
            console.log(chalk.gray(`     Test: ${fail.test}`));
            console.log(chalk.red(`     Error: ${fail.error}`));
        }
        console.log();
    }

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
    console.log(`still running at exit: ${runningTests.length}`);
    console.log(runningTests.join("\n"));
}

function dumpRunningTests() {
    const runningTests = [...runningPages].map((i) => testFiles[i]);
    console.log(`running tests: ${runningTests.length}`);
    console.log(runningTests.join("\n"));
}

if (isMainThread) {
    // partial: mocha flags reach this runner too, and an unknown one used to be ignored
    argv = commandLineArgs(
        [
            { name: "fileFilter", alias: "f", type: String, defaultValue: null, description: "file filter" },
            { name: "testFilter", alias: "t", type: String, defaultValue: null },
            { name: "verbose", alias: "v", type: Boolean, defaultValue: false, description: "use verbose output (multiple lines per test)" },
            { name: "status", type: Boolean, defaultValue: false, description: "display cache and git status information" },
            { name: "help", alias: "h", type: Boolean, defaultValue: false, description: "display help information" },
            { name: "gitAware", type: Boolean, defaultValue: false, description: "enable git-aware selective testing" },
            { name: "reset", type: Boolean, defaultValue: false, description: "reset cache and run all tests from scratch" },
            { name: "all", type: Boolean, defaultValue: false, description: "run all tests (ignore git-aware filtering)" },
            { name: "noStop", type: Boolean, defaultValue: false, description: "continue running tests after failures" },
            { name: "onlyFail", type: Boolean, defaultValue: false, description: "run only tests that failed in previous run" },
            { name: "doc", type: Boolean, defaultValue: false, description: "show the README.md documentation (paged through less on a TTY)" },
            { name: "root", type: String, defaultValue: null, description: "root directory to scan for tests (default: cwd); cache/state files are written here" }
        ],
        { partial: true }
    );

    // resolve the test root once, before anything reads state files
    ROOT = require("node:path").resolve(argv.root || process.cwd());
    DURATIONS_FILE = require("node:path").join(ROOT, ".parallel_test_durations.json");
    loadDurationHistory();

    // In verbose mode, disable compact display
    if (argv.verbose) {
        argv.compact = false;
    } else if (argv.compact === undefined) {
        argv.compact = true; // Default to compact mode
    }
    
    (async () => {
        testFiles = await extractAllTestFiles(ROOT);
        originalTestFileCount = testFiles.length;

        if (argv.help) {
            displayHelp();
            process.exit(0);
        }
        if (argv.doc) {
            await displayDoc();
            process.exit(0);
        }
        if (argv.status) {
            await displayStatus(testFiles);
            process.exit(0);
        }

        // ========== SIGINT HANDLER (CTRL+C) ==========
        let shuttingDown = false;
        process.on('SIGINT', async () => {
            if (shuttingDown) {
                // Force exit if we're already shutting down
                console.log(chalk.yellow('\nForce exiting...'));
                process.exit(130);
            }
            shuttingDown = true;
            screen && screen.stop();
            
            console.log(chalk.yellow('\n\nSIGINT received - saving checkpoint and shutting down gracefully...'));
            
            try {
                // Save checkpoint first
                if (globalTestCache && testFiles && testFiles.length > 0) {
                    const nextFileIndex = Math.min(fileCounter, testFiles.length - 1);
                    const checkpointFile = testFiles[nextFileIndex];
                    
                    globalTestCache.saveCheckpoint({
                        filePath: checkpointFile,
                        testName: "Interrupted by user (CTRL+C)",
                        error: `User interrupted at file ${fileCounter + 1} of ${testFiles.length}`,
                        timestamp: Date.now()
                    });
                    
                    // Save failing tests list
                    if (failingTestList && failingTestList.length > 0) {
                        globalTestCache.saveFailingTests(failingTestList);
                    }
                    
                    console.log(chalk.yellow(`✓ Checkpoint saved - next run will resume from: ${checkpointFile}`));
                }
            } catch (err) {
                console.error(chalk.red('Failed to save checkpoint:'), err.message);
            }
            
            // Terminate all workers
            console.log(chalk.yellow('Terminating worker threads...'));
            const workerPromises = [];
            for (const page of Object.keys(workers)) {
                if (workers[page]) {
                    try {
                        workers[page].terminate();
                        workerPromises.push(
                            new Promise(resolve => {
                                workers[page].on('exit', () => {
                                    resolve();
                                });
                            })
                        );
                    } catch (e) {
                        // ignore
                    }
                }
            }
            
            // Wait for workers to exit (max 2 seconds)
            const timeout = new Promise(resolve => setTimeout(() => {
                console.log(chalk.red('⚠ Workers did not terminate in time'));
                resolve();
            }, 2000));
            
            await Promise.race([
                Promise.allSettled(workerPromises),
                timeout
            ]);
            
            console.log(chalk.green('✓ Shutdown complete'));
            process.exit(130);
        });

                // ========== CACHE & GIT-AWARE INTEGRATION ==========
        try {
            const { TestResultCache } = require("./cache");
            globalTestCache = new TestResultCache(ROOT);
            
            // Handle reset flag
            if (argv.reset) {
                globalTestCache.clear();
                console.log(chalk.yellow("✓ Cache reset - will run all tests from scratch"));
            }
            
            // Get the full list of test files BEFORE any filtering
            const allTestFiles = [...testFiles];
            
            // Initialize cache with current test files (all of them)
            globalTestCache.initialize(allTestFiles);
            
            // Track files skipped by cache (passed and still valid)
            const validPassedFiles = globalTestCache.getValidPassedFiles(allTestFiles);
            filesSkippedByCache = validPassedFiles.length;
            
            // Filter out files that have passed and are still valid
            // This is done regardless of checkpoint - we'll apply checkpoint after
            if (filesSkippedByCache > 0 && !argv.reset && !argv.onlyFail) {
                testFiles = testFiles.filter(file => !validPassedFiles.includes(file));
            }
            
            // Track original count before any filtering
            const filesBeforeOnlyFail = testFiles.length;
            
            // If --onlyFail, filter to only files that contain failing tests
            if (argv.onlyFail) {
                const previousFails = globalTestCache.getFailingTests();
                if (previousFails && previousFails.length > 0) {
                    console.log(chalk.cyan("✓ Running only files with previously failing tests"));
                    // Create a Set of files that have failing tests
                    const filesWithFailures = new Set(previousFails.map(fail => fail.file));
                    testFiles = testFiles.filter(file => 
                        filesWithFailures.has(file)
                    );
                    filesSkippedByOnlyFail = filesBeforeOnlyFail - testFiles.length;
                    console.log(chalk.cyan(`  Running ${testFiles.length} test file(s) with failures`));
                } else {
                    console.log(chalk.yellow("⚠ No previous failing tests found - running all tests"));
                }
            }
            
            // Get checkpoint
            const checkpoint = globalTestCache.getCheckpoint();
            
            // Apply cache filtering if we have a checkpoint
            if (checkpoint && !argv.reset && !argv.onlyFail) {
                const startIndex = testFiles.indexOf(checkpoint.filePath);
                if (startIndex >= 0) {
                    filesSkippedByResume = startIndex;
                    console.log(chalk.yellow("✓ Resuming from checkpoint - skipping " + startIndex + " tests that previously passed"));
                    testFiles = testFiles.slice(startIndex);
                } else {
                    console.log(chalk.yellow("⚠ Checkpoint file not found in current test list - running from start"));
                }
            }
            
            // Track original count before git-aware filtering
            const filesBeforeGitAware = testFiles.length;
            
            // Apply git-aware filtering
            if (gitAwareAvailable && argv.gitAware && !argv.all) {
                const hasGitChanges = hasChanges(ROOT);
                if (hasGitChanges) {
                    const analysis = analyzeChanges({ packagesDir: ROOT, includeDependents: true });
                    // Map package names to their directory paths
                    const allPackages = getAllPackages(ROOT);
                    const packageNameToDir = new Map();
                    for (const pkg of allPackages) {
                        packageNameToDir.set(pkg.name, pkg.dir);
                    }
                    const affectedPackageDirs = analysis.affectedPackages.map(pkgName => packageNameToDir.get(pkgName)).filter(d => d);
                    console.log(chalk.green("✓ Git-aware mode enabled - filtering to " + affectedPackageDirs.length + " affected packages"));
                    testFiles = testFiles.filter(file => 
                        affectedPackageDirs.some(pkgDir => file.startsWith(pkgDir))
                    );
                    filesSkippedByGitAware = filesBeforeGitAware - testFiles.length;
                } else {
                    console.log(chalk.cyan("No git changes detected - running all tests"));
                }
            }
            
            console.log();
            console.log(chalk.bgBlue.white(" "));
            console.log(chalk.bgBlue.white(`  Total: ${testFiles.length} test files to run`));
            console.log(chalk.bgBlue.white(" "));
            
            // Print summary of skipped files
            const totalSkipped = filesSkippedByResume + filesSkippedByCache + filesSkippedByGitAware + filesSkippedByOnlyFail;
            if (totalSkipped > 0) {
                console.log();
                console.log(chalk.bgCyan.white(" "));
                console.log(chalk.bgCyan.white(`  ✓ ${totalSkipped} files skipped (saving time!)`));
                console.log(chalk.bgCyan.white(" "));
                if (filesSkippedByResume > 0) {
                    console.log(chalk.cyan("    ↳ Resume:") + chalk.green(` ${filesSkippedByResume} files`) + chalk.gray(` (previously passed)`));
                }
                if (filesSkippedByCache > 0) {
                    console.log(chalk.cyan("    ↳ Cached:") + chalk.green(` ${filesSkippedByCache} files`) + chalk.gray(` (passed in cache)`));
                }
                if (filesSkippedByGitAware > 0) {
                    console.log(chalk.cyan("    ↳ Git-aware:") + chalk.green(` ${filesSkippedByGitAware} files`) + chalk.gray(` (not in changed packages)`));
                }
                if (filesSkippedByOnlyFail > 0) {
                    console.log(chalk.cyan("    ↳ OnlyFail filter:") + chalk.green(` ${filesSkippedByOnlyFail} files`) + chalk.gray(` (not previously failing)`));
                }
                console.log();
            }
            
        } catch (err) {
            console.log(chalk.yellow("Note: Cache or git-aware features not available - running all tests"));
        }
        // ================================================================
        if (argv.fileFilter) {
            console.log("applying filter", argv.fileFilter);
            const f = new RegExp(argv.fileFilter);
            testFiles = testFiles.filter((file) => file.match(f));
            console.log("filtered test files", testFiles.length);
        }
        if (process.stdin && process.stdin.isTTY && process.stdin.setRawMode) {
            // keypress events only: a readline interface would write its prompt
            // onto stdout. Raw mode swallows SIGINT, so Ctrl+C is handled here.
            readline.emitKeypressEvents(process.stdin);
            process.stdin.setRawMode(true);
            process.stdin.on("keypress", (_str, key) => {
                if (!key) return;
                if (key.ctrl && key.name === "c") {
                    process.emit("SIGINT");
                    return;
                }
                if (key.name === "l") {
                    dumpRunningTests();
                }
                if (key.name === "i") {
                    dumpRunningTests();
                    dumpRunningTestsLogs();
                }
                if (key.name === "h") {
                    console.log(chalk.cyan("keys: Ctrl+C graceful shutdown | l list running tests | i running tests + their logs"));
                }
            });
        }

        const data = {
            index: 0,
            pageCount: 200,
            testFiles,
            g: argv.testFilter
        };

        const infoTimer = setInterval(() => {
            console.log(`--------------------------------- WATCHDOG TICK (every ${durationToString(testWatchDogTimeout)}) - STILL RUNNING `);
            dumpRunningTests();
            dumpRunningTestsLogs();
        }, testWatchDogTimeout);

        fileMax = testFiles.length;
        const promises = [];
        // GitHub runners report few cores, and FACTOR * that rounds down far enough
        // to barely parallelise at all - hence the MIN_WORKER_COUNT floor, capped by
        // the core count so a 2-core runner is not handed 5 workers each spinning up
        // real servers. The floor applies to the computed default only: an explicit
        // CPU=<n> is taken as given, since it exists precisely to override this.
        const coreCount = Math.max(1, os.cpus().length);
        const cpuCount = CPU || Math.max(1, Math.min(Math.max(Math.round(coreCount * FACTOR), MIN_WORKER_COUNT), coreCount));

        workerCount = Math.min(cpuCount, Math.max(1, fileMax));
        process.on("exit", saveDurationHistory);

        console.log();
        console.log(chalk.bgMagenta.white(" "));
        console.log(chalk.bgMagenta.white(`  Running ${chalk.cyan(fileMax)} test files with ${chalk.cyan(cpuCount)} workers`));
        console.log(chalk.bgMagenta.white(" "));
        console.log();

        // In TTY mode with bottom progress
        let progressInterval = null;
        if (argv && argv.compact && useBottomProgress) {
            screen = new TerminalScreen({ footerHeight: 2, tty: true });
            screen.start();
            renderProgress(true);

            // Start a timer to update progress periodically
            // This ensures we don't print progress after every test line
            progressInterval = setInterval(() => {
                renderProgress();
            }, 500);
        }

        runStartedAt = Date.now();
        for (let i = 0; i < cpuCount; i++) {
            promises.push(runTestAndContinue(data));
        }
        await Promise.all(promises);
        
        // In TTY mode: stop progress updates, but DON'T clear yet - epilogue will overwrite
        if (argv && argv.compact && useBottomProgress) {
            clearInterval(progressInterval);
            // Don't clear here - epilogue will overwrite the progress line with summary
        }

        // Report failing tests in noStop mode
        if (argv.noStop) {
            reportFailures();
        }

        // Clear checkpoint if --onlyFail mode succeeded (all tests passed)
        if (argv.onlyFail && failingTestList.length === 0) {
            if (globalTestCache) {
                globalTestCache.clearCheckpoint();
                console.log(chalk.green("✓ All previously failing tests now pass - checkpoint cleared"));
            }
        }

        clearInterval(infoTimer);
        epilogue();

        process.exit(0);
    })();
}
// cli.js is always the main thread; workers are spawned on src/worker.js,
// which self-starts when !isMainThread (see the bottom of worker.js).
// ---------------------------------------------------------------------------
// --doc : render README.md to ANSI and page it through `less -R` on a TTY
// ---------------------------------------------------------------------------

/** inline markdown: `code`, **bold**, *italic*, [text](url) */
function inlineMd(s) {
    return s
        .replace(/`([^`]+)`/g, (_m, c) => chalk.cyan(c))
        .replace(/\*\*([^*]+)\*\*/g, (_m, c) => chalk.bold(c))
        .replace(/\*([^*]+)\*/g, (_m, c) => chalk.italic(c))
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `${chalk.blue.underline(t)} ${chalk.gray(`(${u})`)}`);
}

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[78]/g;
const stripAnsi = (s) => s.replace(ANSI_RE, "");
/** pad a styled string to `w` *visible* columns */
const padVisible = (s, w) => s + " ".repeat(Math.max(0, w - stripAnsi(s).length));

/** parse a markdown table block into aligned, boxed rows */
function renderTableBlock(blockLines) {
    // blockLines: raw lines starting with "|"
    const rows = blockLines.map((l) =>
        l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
    );
    const nCol = Math.max(...rows.map((r) => r.length));
    const norm = rows.map((r) => {
        while (r.length < nCol) r.push("");
        return r;
    });
    const isSep = (r) => r.every((c) => c === "" || /^:?-{2,}:?$/.test(c));
    let header = null;
    let body = norm;
    if (norm.length >= 2 && isSep(norm[1])) {
        header = norm[0];
        body = norm.slice(2);
    } else if (norm.length >= 1) {
        header = norm[0];
        body = norm.slice(1);
    }
    // column widths from the rendered (ANSI) cells
    const widths = [];
    for (let c = 0; c < nCol; c++) {
        let w = 0;
        for (const r of norm) w = Math.max(w, stripAnsi(inlineMd(r[c] || "")).length);
        widths.push(w);
    }
    const border = (l, m, r) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
    const rowLine = (r, style) =>
        chalk.gray("│") + r.map((cell, c) => " " + padVisible(style(cell), widths[c]) + " ").join(chalk.gray("│")) + chalk.gray("│");
    const out = [chalk.gray(border("┌", "┬", "┐"))];
    if (header) {
        out.push(rowLine(header, (c) => chalk.bold.cyan(inlineMd(c))));
        out.push(chalk.gray(border("├", "┼", "┤")));
        for (const r of body) out.push(rowLine(r, inlineMd));
    } else {
        for (const r of norm) out.push(rowLine(r, inlineMd));
    }
    out.push(chalk.gray(border("└", "┴", "┘")));
    return out;
}

/** minimal markdown -> ANSI renderer (headings, fences, lists, tables, hr) */
function renderMarkdown(md) {
    const cols = Math.min(72, (process.stdout.columns || 80) - 8);
    const lines = md.split("\n");
    const out = [];
    let inCode = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*```/.test(line)) {
            out.push(chalk.gray("─".repeat(cols)));
            inCode = !inCode;
            continue;
        }
        if (inCode) {
            out.push(chalk.cyan(line));
            continue;
        }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            const level = h[1].length;
            const text = inlineMd(h[2]);
            if (level === 1) out.push("", chalk.bgBlue.white.bold(` ${text} `), "");
            else if (level === 2) out.push("", chalk.bold.cyan.underline(text), "");
            else if (level === 3) out.push(chalk.bold.yellow(text));
            else out.push(chalk.bold(text));
            continue;
        }
        const t = line.trim();
        if (t === "") {
            out.push("");
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
            out.push(chalk.gray("─".repeat(cols)));
            continue;
        }
        if (t.startsWith("|")) {
            // consume the whole table block, then render it aligned
            const block = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                block.push(lines[i]);
                i++;
            }
            i--; // outer loop increments
            out.push(...renderTableBlock(block));
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            out.push(inlineMd(line).replace(/^(\s*)([-*+])(\s+)/, `$1${chalk.green("•")}$3`));
            continue;
        }
        out.push(inlineMd(line));
    }
    return out.join("\n");
}

/** print the doc: pager on a TTY, plain stream otherwise */
async function displayDoc() {
    const fs = require("node:fs");
    const path = require("node:path");
    const docPath = path.join(__dirname, "..", "README.md");
    let md;
    try {
        md = fs.readFileSync(docPath, "utf8");
    } catch (err) {
        console.error(chalk.red(`cannot read ${docPath}: ${err.message}`));
        process.exit(1);
    }
    const rendered = renderMarkdown(md) + "\n";
    const tty = process.stdout.isTTY === true && process.env.TERM !== "dumb";
    if (tty) {
        const { spawn } = require("node:child_process");
        const pager = process.env.PAGER || "less";
        const args = pager.endsWith("less") ? ["-R", "-F", "-X"] : [];
        const child = spawn(pager, args, { stdio: ["pipe", "inherit", "inherit"] });
        const failed = new Promise((resolve) => child.on("error", () => resolve(true)));
        child.stdin.on("error", () => {});
        child.stdin.write(rendered);
        child.stdin.end();
        const errored = await Promise.race([failed, new Promise((r) => child.on("close", () => r(false)))]);
        if (errored) {
            // pager missing: fall back to direct output
            process.stdout.write(rendered);
        }
        return;
    }
    process.stdout.write(rendered);
}

/**
 * Display help information
 */
function displayHelp() {
    console.log(chalk.bold("\nUsage: parallel-runner [options]  (or: node tools/parallel-runner/src/cli.js [options])\n"));
    console.log(chalk.cyan("Options:"));
    console.log("  -f, --fileFilter <pattern>   Filter test files by regex pattern");
    console.log("  -t, --testFilter <pattern>   Filter tests by regex pattern");
    console.log("  -v, --verbose              Enable verbose output (multiple lines per test)");
    console.log("  -h, --help                 Display this help message");
    console.log("  --status                   Display cache and git status information");
    console.log("  --reset                    Reset cache and run all tests from scratch");
    console.log("  --gitAware                 Enable git-aware selective testing");
    console.log("  --all                      Run all tests (ignore git-aware filtering)");
    console.log("  --noStop                   Continue running after failures (collect all failing tests)");
    console.log("  --onlyFail                 Run only tests that failed in previous run");
    console.log("  --root <dir>               Root directory to scan for tests (default: cwd);");
    console.log("                             cache/duration state files are written there");
    console.log("  --doc                      Show README.md documentation (less on a TTY)");
    console.log("  --compact                  Use compact progress display (single line, default)");
    console.log();
    console.log(chalk.cyan("Progress Display:"));
    console.log("  TTY (terminal):     Progress bar at bottom, updates in place");
    console.log("  CI/CD (no TTY):     ETA prefix at start of each line [ETA Xmin XX% ▏]");
    console.log("  Verbose (-v):       Full details on every test line (old style)");
    console.log();
    console.log(chalk.cyan("Examples:"));
    console.log("  parallel-runner             Run all tests (auto-detects TTY/CI)");
    console.log("  parallel-runner --status    Show cache and git status");
    console.log('  parallel-runner -f "test_.*"     Run tests matching pattern');
    console.log("  parallel-runner --gitAware  Run only tests for changed packages");
    console.log("  parallel-runner --noStop    Run all tests even if some fail");
    console.log("  parallel-runner --onlyFail   Re-run only previously failing tests");
    console.log("  parallel-runner --verbose   Use multi-line verbose output");
    console.log();
}

function dumpRunningTestsLogs() {
    const runningTests = [...runningPages].map((i) => testFiles[i]);
    for (let file of runningTests) {
        const outputs = outputFor[file];
        if (outputs && outputs.length) {
            console.log(chalk.green("log for", file));
            console.log(outputs.join("\n"));
        }
    }
}

/**
 * Display cache and git status
 */
async function displayStatus(allTestFiles) {
    console.log();
    console.log(chalk.bgBlue.white(" ═══════════════════════════════════════════════════════════ "));
    console.log(chalk.bgBlue.white("                   CACHE & GIT STATUS                               "));
    console.log(chalk.bgBlue.white(" ═══════════════════════════════════════════════════════════ "));
    console.log();

    // Cache status
    let TestResultCache;
    try {
        ({ TestResultCache } = require("./cache"));
    } catch (err) {
        console.log(chalk.cyan("📦 Cache Status:"));
        console.log(chalk.red("  Cache module: ✗ Not available"));
        console.log();
    }

    if (TestResultCache) {
        const testCache = new TestResultCache(ROOT);
        const summary = testCache.getSummary(allTestFiles);
        const checkpoint = testCache.getCheckpoint();

        console.log(chalk.cyan("📦 Cache Status:"));
        console.log("  Cache file: " + (summary.cacheExists ? chalk.green("✓ Exists") : chalk.red("✗ Not found")));
        console.log("  Cache valid (suite hash): " + (summary.cacheValid ? chalk.green("✓ Yes") : chalk.red("✗ No")));
        console.log("  Total test files: " + chalk.white(summary.totalFiles));
        const skippable = testCache.getValidPassedFiles(allTestFiles).length;
        const cacheEntries = Object.keys(testCache.cache.results || {}).filter((f) => testCache.cache.results[f].passed).length;
        console.log("  Passed entries in cache file: " + chalk.white(cacheEntries));
        console.log("  Valid cache hits (will be skipped): " + chalk.green(skippable));
        
        if (checkpoint) {
            console.log();
            console.log(chalk.yellow("🎯 Checkpoint Status:"));
            console.log("  Active: " + chalk.yellow("✓ Yes - will resume from checkpoint"));
            console.log("  Failed at: " + chalk.white(checkpoint.filePath || "unknown"));
            console.log("  Test: " + chalk.white(checkpoint.testName || "unknown"));
            console.log("  Error: " + chalk.white(checkpoint.error || "unknown"));
            console.log("  Timestamp: " + chalk.white(new Date(checkpoint.timestamp).toLocaleString()));
            console.log();
            console.log(chalk.cyan("  → Next run will:"));
            console.log("     " + chalk.green("✓ Skip") + " " + skippable + " cached files + files before the checkpoint");
            console.log("     " + chalk.blue("✓ Run") + " from the failing test onward");
        } else {
            console.log();
            console.log(chalk.green("🎯 Checkpoint Status:"));
            console.log("  Active: " + chalk.green("✗ No - will run all tests from scratch"));
            
            if (summary.passedFiles > 0) {
                console.log();
                console.log(chalk.cyan("  → Next run will:"));
                console.log("     " + chalk.green("✓ Skip") + " " + skippable + " cached files");
                console.log("     " + chalk.blue("✓ Run") + " the remaining " + (summary.totalFiles - skippable) + " files");
            } else {
                console.log();
                console.log(chalk.cyan("  → Next run will: Run all tests from scratch"));
            }
        }
        console.log();
    }

    // Git status
    console.log(chalk.magenta("🌿 Git Status:"));
    
    const hasGitChanges = gitAwareAvailable ? hasChanges() : false;
    const repoRoot = gitAwareAvailable ? findRepoRoot() : null;
    console.log("  Repository: " + chalk.white(repoRoot || "Not a git repo"));
    
    if (gitAwareAvailable && hasGitChanges) {
        console.log("  Changes detected: " + chalk.green("✓ Yes"));
        const analysis = analyzeChanges({ packagesDir: ROOT, includeDependents: true });
        console.log("  Changed files: " + chalk.white(analysis.changedFiles.length));
        console.log("  Changed packages: " + chalk.white(analysis.changedPackages.length));
        console.log("  Affected packages: " + chalk.white(analysis.affectedPackages.length));
        console.log();
        console.log(chalk.cyan("  → Git-aware mode will:"));
        console.log("     " + chalk.blue("✓ Test") + " only " + analysis.affectedPackages.length + " affected packages");
        console.log("     " + chalk.green("✓ Skip") + " " + analysis.skippedCount + " unchanged packages");
    } else if (gitAwareAvailable) {
        console.log("  Changes detected: " + chalk.red("✗ No"));
        console.log();
        console.log(chalk.cyan("  → Git-aware mode will: Run all tests (no changes to filter)"));
    } else {
        console.log("  Git-aware module: " + chalk.red("✗ Not available"));
    }
    console.log();

    // Combined recommendation
    console.log(chalk.bgCyan.white(" ═══════════════════════════════════════════════════════════ "));
    console.log(chalk.bgCyan.white("                      RECOMMENDATION                                "));
    console.log(chalk.bgCyan.white(" ═══════════════════════════════════════════════════════════ "));
    console.log();
    
    if (TestResultCache && gitAwareAvailable) {
        const testCache = new TestResultCache(ROOT);
        const checkpoint = testCache.getCheckpoint();
        const hasGitChanges = hasChanges(ROOT);
        
        if (checkpoint) {
            console.log(chalk.yellow("  You have a checkpoint from a failed test."));
            console.log(chalk.yellow("  Next run will automatically resume from the failing test."));
            console.log();
            console.log(chalk.yellow("  To start fresh:"));
            console.log("    " + chalk.cyan("parallel-runner --reset"));
        } else if (hasGitChanges) {
            console.log(chalk.green("  You have git changes."));
            console.log(chalk.green("  Git-aware mode will only test affected packages."));
            console.log();
            console.log(chalk.green("  To run all tests:"));
            console.log("    " + chalk.cyan("parallel-runner --all"));
        } else {
            console.log(chalk.green("  You have a fresh state."));
            console.log(chalk.green("  No checkpoint, no git changes."));
            console.log();
            console.log(chalk.green("  Next run will execute all tests from scratch."));
        }
    } else {
        console.log(chalk.white("  Run with full features:"));
        console.log("    " + chalk.cyan("parallel-runner --gitAware"));
    }
    
    console.log();
}
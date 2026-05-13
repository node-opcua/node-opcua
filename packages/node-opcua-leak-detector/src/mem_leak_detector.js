// memoryLeakDetector.js
let wtf;

if (process.env.MEM_LEAK_DETECTION_WTF_ENABLED) {
    console.log("[LeakDetector] ⚠️ WTFNODE enabled");
    wtf = require("wtfnode");
    wtf.init();
} else {
    console.log("[LeakDetector] ℹ️  WTFNODE disabled. Use MEM_LEAK_DETECTION_WTF_ENABLED=true to enable it.");
}

let noGCexposed;

/**
 * Forces garbage collection if available.
 */
function forceGC() {
    if (global.gc) {
        // Major GC: thorough enough that callers don't need to invoke a separate
        // global.gc(true) themselves before calling takeMemorySnapshot.
        global.gc(true);
        noGCexposed = false;
    } else {
        if (noGCexposed === undefined) {
            console.warn(
                "[LeakDetector] ⚠️ Garbage collection not exposed. Run Node.js with --expose-gc flag for more accurate results."
            );
        }
        noGCexposed = true;
    }
}

/**
 * Takes a memory snapshot.
 * @returns {number} Heap used in bytes.
 */
function takeMemorySnapshot() {
    if (noGCexposed) {
        return;
    }
    const { performance } = require("node:perf_hooks");
    const start = performance.now();
    forceGC();
    const end = performance.now();
    const duration = (end - start).toFixed(2);
    if (duration > 1) {
        console.log(`[LeakDetector] ♻️  Garbage collection took ${duration}ms`);
    }
    return process.memoryUsage().heapUsed;
}

/**
 * Checks for memory leaks between before and after snapshots.
 * @param {number} before - Heap used before test.
 * @param {number} after - Heap used after test.
 * @param {number} [threshold=10] - Threshold in MB to consider as a leak.
 * @returns {Object} - Result with before/after memory and leak status.
 */
function checkForMemoryLeak(before, after, threshold = 2) {
    if (noGCexposed) {
        return;
    }
    const heapUsedBefore = before / 1024 / 1024; // MB
    const heapUsedAfter = after / 1024 / 1024; // MB
    const delta = heapUsedAfter - heapUsedBefore;
    const isLeak = delta > threshold;

    if (isLeak) {
        console.warn(
            `[LeakDetector] ⚠️ Potential memory leak detected in test: ${delta.toFixed(2)} MB increase (threshold: ${threshold} MB , total : ${heapUsedAfter.toFixed(2)} MB)`
        );
    } else {
        console.log(
            `[LeakDetector] ✅ No significant memory leak detected: ${delta.toFixed(2)} MB increase total : ${heapUsedAfter.toFixed(2)} MB`
        );
    }

    wtf?.dump({ fullStacks: true }); // Show open handles, listeners, etc.

    return { before: heapUsedBefore, after: heapUsedAfter, delta, isLeak };
}

module.exports = { takeMemorySnapshot, checkForMemoryLeak };

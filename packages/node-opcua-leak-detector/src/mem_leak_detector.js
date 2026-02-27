// memoryLeakDetector.js

const wtf = require('wtfnode');

let noGCexposed= undefined;

/**
 * Forces garbage collection if available.
 */
function forceGC() {
  if (global.gc) {
    global.gc();
    noGCexposed = false;
  } else {
    if (noGCexposed == undefined) {
      console.warn('⚠️ Garbage collection not exposed. Run Node.js with --expose-gc flag for more accurate results.');
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
  forceGC();
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

  if(noGCexposed) {
    return;
  }
  const heapUsedBefore = before / 1024 / 1024; // MB
  const heapUsedAfter = after / 1024 / 1024; // MB
  const delta = heapUsedAfter - heapUsedBefore;
  const isLeak = delta > threshold;

  if (isLeak) {
    console.warn(
      `⚠️ Potential memory leak detected in test: ${delta.toFixed(2)} MB increase (threshold: ${threshold} MB)`
    );
  } else {
    console.log(
      `✅ No significant memory leak detected: ${delta.toFixed(2)} MB increase`
    );
  }


  wtf.dump({fullStacks: true}); // Show open handles, listeners, etc.

  return { before: heapUsedBefore, after: heapUsedAfter, delta, isLeak };
}

module.exports =  { takeMemorySnapshot, checkForMemoryLeak };
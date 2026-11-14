const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CACHE_FILENAME = ".parallel_test_cache.json";

/**
 * Compute a hash for a test file based on its content and modification time
 */
function computeFileHash(filePath) {
    try {
        const stat = fs.statSync(filePath);
        // Use mtime + size for fast hash (content hash would be slower but more accurate)
        return crypto
            .createHash("md5")
            .update(filePath)
            .update(stat.mtimeMs.toString())
            .update(stat.size.toString())
            .digest("hex");
    } catch (err) {
        return "";
    }
}

/**
 * Compute hash for all test files to detect any changes
 */
function computeTestSuiteHash(testFiles) {
    const hash = crypto.createHash("md5");
    for (const file of testFiles) {
        hash.update(computeFileHash(file));
    }
    return hash.digest("hex");
}

/**
 * Cache structure:
 * {
 *   version: "2.0",
 *   testSuiteHash: "abc123...",  // hash of all test files
 *   testFiles: ["path/to/test1.ts", ...],
 *   fileHashes: { // NEW: per-file hashes for better invalidation
 *     "path/to/test1.ts": "hash1",
 *     "path/to/test2.ts": "hash2"
 *   },
 *   results: {
 *     "path/to/test1.ts": {
 *       passed: true,
 *       hash: "hash1",  // hash at time of passing
 *       lastRun: "2024-01-01T00:00:00.000Z",
 *       tests: ["test name 1", "test name 2"]
 *     }
 *   },
 *   checkpoint: {
 *     filePath: "/path/to/failing/test.ts",
 *     testName: "test that failed",
 *     error: "error message",
 *     timestamp: 1234567890
 *   },
 *   failingTests: [
 *     { file: "...", test: "...", error: "...", timestamp: 123 }
 *   ]
 * }
 */

class TestResultCache {
    constructor(dir = process.cwd()) {
        this.cacheFile = path.join(dir, CACHE_FILENAME);
        this.cache = this.load();
        // Migrate from v1 to v2 if needed
        if (this.cache.version !== "2.0") {
            this.migrate();
        }
    }

    load() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const content = fs.readFileSync(this.cacheFile, "utf8");
                return JSON.parse(content);
            }
        } catch (err) {
            console.warn(`[parallel_test_cache] Failed to load cache: ${err.message}`);
        }
        return {
            version: "2.0",
            testSuiteHash: "",
            testFiles: [],
            fileHashes: {},
            results: {},
            checkpoint: null,
            failingTests: []
        };
    }

    save() {
        try {
            const content = JSON.stringify(this.cache, null, 2);
            fs.writeFileSync(this.cacheFile, content, "utf8");
        } catch (err) {
            console.warn(`[parallel_test_cache] Failed to save cache: ${err.message}`);
        }
    }

    migrate() {
        // If v1 cache, migrate to v2
        if (this.cache.version === "1.0") {
            this.cache.version = "2.0";
            this.cache.fileHashes = {};
            // Compute file hashes for all test files in the cache
            for (const filePath of this.cache.testFiles || []) {
                this.cache.fileHashes[filePath] = computeFileHash(filePath);
            }
            // Also ensure results have hashes
            for (const [filePath, result] of Object.entries(this.cache.results || {})) {
                if (!result.hash) {
                    result.hash = computeFileHash(filePath);
                }
            }
            this.save();
        }
    }

    /**
     * Check if cache is valid for the given test files
     * In v2, we check individual file hashes instead of suite hash
     */
    isValid(testFiles) {
        // If no testFiles in cache, it's not valid
        if (!this.cache.testFiles || this.cache.testFiles.length === 0) {
            return false;
        }
        
        // Check if all cached test files still exist and have the same hash
        for (const filePath of this.cache.testFiles) {
            const currentHash = computeFileHash(filePath);
            const cachedHash = this.cache.fileHashes?.[filePath];
            if (currentHash !== cachedHash) {
                return false; // File has changed
            }
        }
        return true;
    }

    /**
     * Check if a specific file is still valid in cache
     */
    isFileValid(filePath) {
        const result = this.cache.results?.[filePath];
        if (!result) return false;

        const currentHash = computeFileHash(filePath);
        // Validity = unchanged since it passed. result.hash is the hash recorded
        // at pass time; fileHashes is refreshed on every run (initialize/markFilePassed),
        // so comparing against it would make every entry look valid forever.
        return currentHash === (result.hash || this.cache.fileHashes?.[filePath]);
    }

    /**
     * Initialize cache for a new test run
     */
    initialize(testFiles) {
        this.cache.testFiles = testFiles;
        this.cache.testSuiteHash = computeTestSuiteHash(testFiles);
        
        // Record hashes for files we have not seen yet; do NOT overwrite existing
        // entries (isFileValid compares against the hash stored at pass time).
        if (!this.cache.fileHashes) {
            this.cache.fileHashes = {};
        }
        for (const filePath of testFiles) {
            if (!this.cache.fileHashes[filePath]) {
                this.cache.fileHashes[filePath] = computeFileHash(filePath);
            }
        }
        
        this.save();
    }

    /**
     * Reset the cache
     */
    reset() {
        this.cache = {
            version: "2.0",
            testSuiteHash: "",
            testFiles: [],
            fileHashes: {},
            results: {},
            checkpoint: null,
            failingTests: []
        };
        try {
            fs.unlinkSync(this.cacheFile);
        } catch (err) {
            // Ignore if file doesn't exist
        }
    }

    /**
     * Get the starting index for test files
     */
    getStartIndex(reset, testFiles) {
        if (reset) {
            return 0;
        }
        const checkpoint = this.cache.checkpoint;
        if (checkpoint && checkpoint.filePath) {
            return testFiles.indexOf(checkpoint.filePath);
        }
        return 0;
    }

    /**
     * Mark a test file as passed
     */
    markFilePassed(filePath, testNames = []) {
        if (!this.cache.results) {
            this.cache.results = {};
        }
        if (!this.cache.fileHashes) {
            this.cache.fileHashes = {};
        }
        
        const fileHash = computeFileHash(filePath);
        this.cache.fileHashes[filePath] = fileHash;
        
        this.cache.results[filePath] = {
            passed: true,
            hash: fileHash,
            lastRun: new Date().toISOString(),
            tests: testNames
        };
        this.save();
    }

    /**
     * Mark a test file as failed
     */
    markFileFailed(filePath, testName = "", error = "") {
        this.cache.checkpoint = {
            filePath,
            testName,
            error,
            timestamp: Date.now()
        };
        this.save();
    }

    /**
     * Save a checkpoint for resuming
     */
    saveCheckpoint({ filePath, testName = "", error = "", timestamp = Date.now() }) {
        this.cache.checkpoint = {
            filePath,
            testName,
            error,
            timestamp
        };
        this.save();
    }

    /**
     * Get the checkpoint information
     */
    getCheckpoint() {
        return this.cache.checkpoint;
    }

    /**
     * Get list of previously failing tests
     */
    getFailingTests() {
        if (this.cache.failingTests) {
            return this.cache.failingTests;
        }
        return [];
    }

    /**
     * Save list of failing tests
     */
    saveFailingTests(failingTests) {
        this.cache.failingTests = failingTests;
        this.save();
    }

    /**
     * Check if a specific test file has passed
     */
    hasFilePassed(filePath) {
        const result = this.cache.results?.[filePath];
        if (!result) return false;
        
        // Check if the file has changed since it was cached
        if (!this.isFileValid(filePath)) {
            return false;
        }
        
        return result.passed || false;
    }

    /**
     * Get files that have passed and are still valid
     */
    getValidPassedFiles(testFiles) {
        const validPassed = [];
        for (const filePath of testFiles) {
            if (this.hasFilePassed(filePath)) {
                validPassed.push(filePath);
            }
        }
        return validPassed;
    }

    /**
     * Get the number of passed test files
     */
    getPassedCount() {
        let count = 0;
        for (const [filePath, result] of Object.entries(this.cache.results || {})) {
            if (result.passed && this.isFileValid(filePath)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Clear the entire cache
     */
    clear() {
        this.cache = {
            version: "2.0",
            testSuiteHash: "",
            testFiles: [],
            fileHashes: {},
            results: {},
            checkpoint: null,
            failingTests: []
        };
        try {
            fs.unlinkSync(this.cacheFile);
        } catch (err) {
            // Ignore
        }
        this.save();
    }

    /**
     * Clear only the checkpoint
     */
    clearCheckpoint() {
        this.cache.checkpoint = null;
        this.save();
    }

    /**
     * Get the list of test files to run based on cache state
     * Returns files that haven't passed or have changed
     */
    getTestFilesToRun(testFiles, reset) {
        if (reset) {
            return testFiles;
        }
        
        const startIndex = this.getStartIndex(reset, testFiles);
        
        // If we have a checkpoint, start from there
        if (this.cache.checkpoint) {
            return testFiles.slice(startIndex);
        }
        
        // Otherwise, filter out files that have passed and are still valid
        const validPassed = new Set(this.getValidPassedFiles(testFiles));
        return testFiles.filter(filePath => !validPassed.has(filePath));
    }

    /**
     * Get summary of cached results
     */
    getSummary(testFiles) {
        const totalFiles = testFiles.length;
        
        // Count passed files that are still valid
        let passedFiles = 0;
        let invalidFiles = 0;
        for (const [filePath, result] of Object.entries(this.cache.results || {})) {
            if (result.passed) {
                if (this.isFileValid(filePath)) {
                    passedFiles++;
                } else {
                    invalidFiles++;
                }
            }
        }
        
        const startIndex = this.getStartIndex(false, testFiles);
        const filesToRun = totalFiles - startIndex;
        
        // Check if cache is valid for these test files
        const cacheValid = this.isValid(testFiles);
        
        return {
            totalFiles,
            passedFiles,
            invalidFiles,
            filesToRun,
            checkpoint: this.cache.checkpoint,
            cacheValid,
            cacheExists: fs.existsSync(this.cacheFile)
        };
    }
}

module.exports = { TestResultCache, computeFileHash };

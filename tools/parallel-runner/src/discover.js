"use strict";
/**
 * discover.js — test-file discovery for @sterfive/parallel-runner.
 *
 * Parameterized by a root directory so the runner works both for this
 * monorepo (root = packages/, tests live in <pkg>/test/) and for a single
 * package (root = the package dir, tests live in <root>/test/).
 */
const fs = require("node:fs");
const path = require("node:path");

/** a spec: optionally numbered, named test_ or repro_ */
const SPEC_TS = /^(\d+[-_])?(test|repro)_.*\.ts$/;
const SPEC_JS = /^(\d+[-_])?(test|repro)_.*\.js$/;

async function collectFiles(testFiles, testFolder) {
    const files = await fs.promises.readdir(testFolder);
    for (const file of files) {
        const f = path.join(testFolder, file);
        const stat = await fs.promises.lstat(f);
        if (stat.isDirectory()) {
            await collectFiles(testFiles, f);
        } else if (SPEC_TS.test(file) && !/\.d\.ts$/.test(file)) {
            testFiles.push(f);
        } else if (SPEC_JS.test(file)) {
            // ignore transpiled .js when the .ts source sits alongside
            if (!fs.existsSync(f.replace(/\.js$/, ".ts"))) {
                testFiles.push(f);
            }
        }
    }
}

/**
 * Collect every test file under `root`.
 * Scans <root>/test and <root>/<sub>/test directories.
 * @param {string} root absolute root directory
 * @returns {Promise<string[]>} sorted absolute test file paths
 */
async function extractAllTestFiles(root) {
    const testFiles = [];
    const promises = [];
    const rootTest = path.join(root, "test");
    if (fs.existsSync(rootTest) && fs.lstatSync(rootTest).isDirectory()) {
        promises.push(collectFiles(testFiles, rootTest));
    }
    for (const entry of await fs.promises.readdir(root)) {
        const subTest = path.join(root, entry, "test");
        if (fs.existsSync(subTest) && fs.lstatSync(subTest).isDirectory()) {
            promises.push(collectFiles(testFiles, subTest));
        }
    }
    await Promise.all(promises);
    return testFiles.sort();
}

/** slice one page out of the file list (same paging semantics as before) */
async function extractPageTest(testFiles, { page, pageSize }) {
    if (page !== undefined) {
        testFiles = testFiles.slice(page * pageSize, (page + 1) * pageSize);
    }
    return testFiles;
}

module.exports = { extractAllTestFiles, extractPageTest };

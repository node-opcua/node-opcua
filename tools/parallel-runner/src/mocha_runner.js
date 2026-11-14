"use strict";
/**
 * mocha_runner.js — mocha execution for @sterfive/parallel-runner workers.
 *
 * Ports the loader hooks and `runtests` from packages/run_all_mocha_tests.js so
 * the tool is self-contained: Node's own type stripping runs .ts test files, with
 * a resolver redirect that prefers a package's compiled dist/ output (keeps enums
 * and parameter properties out of the stripper). TSX=1 falls back to tsx.
 */
const fs = require("node:fs");
const path = require("node:path");
const chalk = require("chalk").default;
const { Mocha } = require("mocha");
require("mocha-clean");

const { registerHooks } = require("node:module");
const { pathToFileURL, fileURLToPath } = require("node:url");

if (!process.env.TSX) {
    const exists = (p) => fs.existsSync(p);

    /** the package a file belongs to, i.e. the nearest directory holding a package.json */
    const packageRootOf = (file) => {
        let dir = path.dirname(file);
        for (let i = 0; i < 12; i++) {
            if (exists(path.join(dir, "package.json"))) return dir;
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        return null;
    };

    const SOURCE_DIRS = new Set(["source", "src", "api", "impl", "source_nodejs"]);
    const compiledCandidates = (jsPath) => {
        const pkgDir = packageRootOf(jsPath);
        if (!pkgDir) return [];
        const rel = path.relative(pkgDir, jsPath).replace(/\\/g, "/");
        const [first, ...rest] = rel.split("/");
        if (!SOURCE_DIRS.has(first) || rest.length === 0) {
            return [path.join(pkgDir, "dist", rel)];
        }
        return [path.join(pkgDir, "dist", rest.join("/")), path.join(pkgDir, "dist", rel)];
    };

    registerHooks({
        resolve(specifier, context, nextResolve) {
            if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
                const jsPath = fileURLToPath(new URL(specifier, context.parentURL));
                if (!exists(jsPath)) {
                    for (const candidate of compiledCandidates(jsPath)) {
                        if (exists(candidate)) {
                            return nextResolve(pathToFileURL(candidate).href, context);
                        }
                    }
                    const tsPath = jsPath.replace(/\.js$/, ".ts");
                    if (exists(tsPath)) {
                        return nextResolve(pathToFileURL(tsPath).href, context);
                    }
                }
            }
            return nextResolve(specifier, context);
        }
    });
} else {
    require("tsx/esm/api").register();
}

Error.stackTraceLimit = 20;

/** warn when an OPCUAClient test forgets its leak-detection hook (node-opcua specific, kept for compat) */
function testNoLeak(file) {
    try {
        const sourceCode = fs.readFileSync(file, "utf-8");
        if (sourceCode.match("OPCUAClient") && !sourceCode.match("Leak")) {
            console.log(chalk.yellow(" OPCUAClient without leak detection mechanism  !!!"), file);
        }
    } catch (_err) {
        /* best effort */
    }
}

/**
 * Run a list of test files under mocha with the given reporter.
 * @returns {Promise<number>} number of failures
 */
async function runtests({ selectedTests, reporter, dryRun, filterOpts }) {
    const mocha = new Mocha({
        bail: true,
        fullTrace: true,
        grep: filterOpts,
        dryRun,
        timeout: 80000,
        reporter,
        slow: 6000
    });

    for (const file of selectedTests) {
        testNoLeak(file);
        mocha.addFile(file);
    }
    mocha.timeout(200000);
    mocha.bail(!process.env.NO_BAIL);
    mocha.lazyLoadFiles(true);

    if (!process.env.TSX) {
        // load one file at a time so a single unloadable file does not abort the run
        const unloadable = [];
        const queued = mocha.files.slice();
        for (const file of queued) {
            mocha.files = [file];
            try {
                await mocha.loadFilesAsync();
            } catch (err) {
                unloadable.push({ file, message: (err && err.message) || String(err) });
            }
        }
        mocha.files = queued;
        if (unloadable.length) {
            console.log(
                `\n${chalk.yellow(`${unloadable.length} file(s) could not be loaded; set TSX=1 to fall back to tsx`)}`
            );
            for (const u of unloadable) {
                console.log(`  ${u.file}\n      ${u.message.split("\n")[0]}`);
            }
            console.log("");
        }
    } else {
        await mocha.loadFilesAsync();
    }

    return await new Promise((resolve) => {
        mocha.run((failures) => resolve(failures));
    });
}

module.exports = { runtests };

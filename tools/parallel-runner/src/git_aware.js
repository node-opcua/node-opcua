const fs = require("node:fs");
const path = require("node:path");
const { execSync, execFileSync } = require("node:child_process");

/**
 * Git-aware test selection for parallel_test
 * 
 * This module analyzes git changes and package dependencies to determine
 * which tests need to run, drastically reducing test time by skipping
 * unchanged packages.
 */

/**
 * Get git status (modified, staged, untracked files)
 * @returns {Array} Array of changed file paths (relative to repo root)
 */
function getGitChangedFiles(packagesDir = null) {
    return getGitChanges(packagesDir).changedFiles;
}

/** top-level repo files whose change can affect any package's tests */
const GLOBAL_CONFIG_RE = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|package-lock\.json|tsconfig[^/]*\.json|\.mocharc[^/]*)$/;

/**
 * Working-tree changes (staged, unstaged, untracked; not ignored).
 * Parsed from `git status --porcelain -z`, so renames and paths with spaces
 * are handled, and run with execFileSync (no shell).
 * @returns {{ changedFiles: string[], globalChanges: string[], repoRoot: string|null }}
 *   changedFiles: absolute paths under packagesDir
 *   globalChanges: repo-level config files (lockfile, root tsconfig, ...) and
 *                  files directly in packagesDir that belong to no package
 */
/** sort repo-relative paths into package changes and repo-level config changes */
function classifyChanges(relPaths, repoRoot, dir) {
    const changed = new Set();
    const global = new Set();
    for (const p of relPaths) {
        const abs = path.resolve(repoRoot, p);
        const base = path.basename(abs);
        if (base.startsWith(".parallel_test_")) continue; // the runner's own state files
        if (GLOBAL_CONFIG_RE.test(p)) {
            global.add(abs);
        } else if (abs.startsWith(dir + path.sep)) {
            changed.add(abs);
            // a config file sitting directly in packagesDir (tsconfig, .mocharc)
            if (path.dirname(abs) === dir && GLOBAL_CONFIG_RE.test(base)) global.add(abs);
        }
    }
    return { changedFiles: [...changed], globalChanges: [...global] };
}

function getGitChanges(packagesDir = null) {
    const repoRoot = findRepoRoot(packagesDir || process.cwd());
    if (!repoRoot) {
        return { changedFiles: [], globalChanges: [], repoRoot: null };
    }
    const dir = path.resolve(packagesDir || path.join(repoRoot, "packages"));
    try {
        const out = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 256 * 1024 * 1024
        });
        const relPaths = [];
        const recs = out.split("\0");
        for (let i = 0; i < recs.length; i++) {
            const rec = recs[i];
            if (rec.length < 4) continue;
            const xy = rec.slice(0, 2);
            relPaths.push(rec.slice(3));
            if (xy[0] === "R" || xy[0] === "C") {
                // rename / copy: the next NUL-separated record is the old path
                i++;
                if (recs[i]) relPaths.push(recs[i]);
            }
        }
        return { ...classifyChanges(relPaths, repoRoot, dir), repoRoot };
    } catch (err) {
        console.warn(`[git-aware] Could not get git status: ${err.message}`);
        return { changedFiles: [], globalChanges: [], repoRoot };
    }
}

/**
 * Get files changed since a specific commit (default: HEAD)
 * @param {string} commit - Commit hash or reference (default: HEAD)
 * @returns {Array} Array of changed file paths
 */
function getGitChangedFilesSince(commit = "HEAD", startDir = process.cwd()) {
    return getGitChangesSince(commit, startDir).changedFiles;
}

/**
 * Changes of this branch relative to `ref` (e.g. master, origin/master, a sha):
 *   - everything that differs between the merge-base of `ref` and HEAD and the
 *     working tree (committed on the branch + staged + unstaged), deletions and
 *     both sides of renames included: `git diff --name-only --no-renames <base>`
 *   - plus untracked, non-ignored files
 * The merge-base matters: diffing against the tip of `ref` would also count
 * everything that landed on `ref` since the branch was created.
 * @returns {{ changedFiles: string[], globalChanges: string[], repoRoot: string|null, base: string|null, error?: string }}
 */
function getGitChangesSince(ref, packagesDir = null) {
    const repoRoot = findRepoRoot(packagesDir || process.cwd());
    if (!repoRoot) {
        return { changedFiles: [], globalChanges: [], repoRoot: null, base: null, error: "not a git repository" };
    }
    const dir = path.resolve(packagesDir || path.join(repoRoot, "packages"));
    const git = (...args) =>
        execFileSync("git", args, {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            maxBuffer: 256 * 1024 * 1024
        });
    let base;
    try {
        git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
    } catch (_err) {
        return { changedFiles: [], globalChanges: [], repoRoot, base: null, error: `unknown git reference "${ref}"` };
    }
    try {
        base = git("merge-base", ref, "HEAD").trim();
    } catch (_err) {
        base = git("rev-parse", `${ref}^{commit}`).trim(); // unrelated histories: diff against ref itself
    }
    const relPaths = [
        ...git("diff", "--name-only", "--no-renames", "-z", base).split("\0"),
        ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")
    ].filter(Boolean);
    return { ...classifyChanges(relPaths, repoRoot, dir), repoRoot, base };
}

/**
 * Find the git repository root
 * @returns {string|null} Repository root path or null
 */
function findRepoRoot(startDir = process.cwd()) {
    try {
        const repoRoot = execSync(
            "git rev-parse --show-toplevel",
            { cwd: startDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        ).trim();
        return repoRoot || null;
    } catch (err) {
        return null;
    }
}

/**
 * Check if a file is a test file
 * @param {string} filePath - Absolute file path
 * @returns {boolean}
 */
function isTestFile(filePath) {
    const testPatterns = [
        /\/test\//,
        /\/test_/,
        /_test\./,
        /_test\.ts$/,
        /_test\.js$/,
        /\.test\./,
        /\.spec\./
    ];
    
    return testPatterns.some(pattern => filePath.match(pattern));
}

/**
 * Get the package directory for a given file
 * @param {string} filePath - Absolute file path
 * @param {string} packagesDir - Root packages directory
 * @returns {string|null} Package directory or null
 */
function getPackageForFile(filePath, packagesDir) {
    // Normalize paths and convert to absolute
    const normalizedFilePath = path.normalize(filePath);
    const normalizedPackagesDir = path.normalize(path.resolve(packagesDir));
    
    // Check if the file is directly in packagesDir (like parallel_test.js)
    // In this case, it's a helper file, not part of a package
    if (normalizedFilePath.startsWith(normalizedPackagesDir)) {
        const relativePath = path.relative(normalizedPackagesDir, normalizedFilePath);
        const parts = relativePath.split(path.sep);
        
        // Try each part as a potential package
        let currentPath = normalizedPackagesDir;
        for (const part of parts) {
            if (part === ".." || part === ".") continue;
            currentPath = path.join(currentPath, part);
            if (fs.existsSync(path.join(currentPath, "package.json"))) {
                return currentPath;
            }
        }
    }
    
    // Try going up directories until we find a package.json
    let currentDir = path.dirname(normalizedFilePath);
    while (currentDir && currentDir.startsWith(normalizedPackagesDir)) {
        if (fs.existsSync(path.join(currentDir, "package.json"))) {
            return currentDir;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }
    
    return null;
}

/**
 * Get all packages in the monorepo
 * @param {string} packagesDir - Root packages directory
 * @returns {Array} Array of { name, dir, packageJson } objects
 */
function getAllPackages(packagesDir) {
    const packages = [];
    
    // Convert to absolute path
    const absolutePackagesDir = path.resolve(packagesDir);
    
    if (!fs.existsSync(absolutePackagesDir)) {
        return packages;
    }
    
    const entries = fs.readdirSync(absolutePackagesDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const packageDir = path.join(absolutePackagesDir, entry.name);
            const packageJsonPath = path.join(packageDir, "package.json");
            
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
                    packages.push({
                        name: packageJson.name || entry.name,
                        dir: packageDir,
                        packageJson
                    });
                } catch (err) {
                    console.warn(`[git-aware] Could not read package.json in ${packageDir}: ${err.message}`);
                }
            }
        }
    }
    
    return packages;
}

/**
 * Build a dependency graph from packages
 * @param {Array} packages - Array of package objects
 * @returns {Object} Dependency graph: { packageName: Set<dependentPackageNames> }
 */
function buildDependencyGraph(packages) {
    const graph = {};
    const nameToPackage = {};
    
    // Index packages by name
    for (const pkg of packages) {
        nameToPackage[pkg.name] = pkg;
        graph[pkg.name] = new Set();
    }
    
    // Build forward dependencies (who depends on whom)
    for (const pkg of packages) {
        const deps = { ...pkg.packageJson.dependencies || {}, ...pkg.packageJson.devDependencies || {} };
        
        for (const depName of Object.keys(deps)) {
            // Check if this dependency is a local workspace package
            if (nameToPackage[depName]) {
                // pkg depends on depName, so add reverse dependency
                // graph[depName] should already be initialized as a Set
                if (graph[depName] && typeof graph[depName].add === 'function') {
                    graph[depName].add(pkg.name);
                }
            }
        }
    }
    
    return graph;
}

/**
 * Get all packages that depend on the given packages (transitive)
 * @param {Object} graph - Dependency graph
 * @param {Array} packageNames - Array of package names
 * @returns {Set} Set of all dependent package names
 */
function getDependentPackages(graph, packageNames) {
    const visited = new Set();
    const queue = [...packageNames];
    
    while (queue.length > 0) {
        const pkgName = queue.shift();
        
        if (visited.has(pkgName)) continue;
        visited.add(pkgName);
        
        const dependents = graph[pkgName] || new Set();
        for (const dependent of dependents) {
            if (!visited.has(dependent)) {
                queue.push(dependent);
            }
        }
    }
    
    return visited;
}

/**
 * Analyze changed files and determine which packages need testing
 * @param {Object} options - Configuration options
 * @param {string} options.packagesDir - Root packages directory
 * @param {boolean} options.includeDependents - Include packages that depend on changed packages
 * @param {string} options.sinceCommit - Git commit to compare against (default: current status)
 * @returns {Object} Analysis result with affected packages and test files
 */
function analyzeChanges(options = {}) {
    const {
        packagesDir = process.cwd(),
        includeDependents = true,
        sinceCommit = null
    } = options;
    const absolutePackagesDir = path.resolve(packagesDir);
    
    const repoRoot = findRepoRoot(absolutePackagesDir);
    if (!repoRoot) {
        return {
            changedFiles: [],
            changedPackages: [],
            affectedPackages: [],
            affectedTestFiles: [],
            skippedPackages: [],
            reason: "Not a git repository"
        };
    }
    
    // Get changed files
    let changedFiles;
    let globalChanges = [];
    let base = null;
    if (sinceCommit) {
        const since = getGitChangesSince(sinceCommit, absolutePackagesDir);
        if (since.error) {
            throw new Error(`--since: ${since.error}`);
        }
        ({ changedFiles, globalChanges, base } = since);
    } else {
        ({ changedFiles, globalChanges } = getGitChanges(absolutePackagesDir));
    }
    if (globalChanges.length > 0) {
        // lockfile / root tsconfig / mocharc: can affect every package
        return {
            changedFiles,
            base,
            globalChanges,
            changedPackages: [],
            affectedPackages: [],
            affectedTestFiles: [],
            skippedPackages: [],
            skippedCount: 0,
            runAll: true,
            reason: `repo-level config changed: ${globalChanges.map((f) => path.basename(f)).join(", ")}`
        };
    }
    
    if (changedFiles.length === 0) {
        return {
            changedFiles: [],
            base,
            changedPackages: [],
            affectedPackages: [],
            affectedTestFiles: [],
            skippedPackages: [],
            reason: "No changes detected"
        };
    }
    
    // Get all packages
    const packages = getAllPackages(packagesDir);
    const packageMap = new Map(packages.map(p => [p.name, p]));
    
    // Build dependency graph
    const depGraph = buildDependencyGraph(packages);
    
    // Map changed files to packages
    const changedPackages = new Set();
    const sourceChangedPackages = new Set();
    const testChangedPackages = new Set();
    const nonPackageFiles = [];
    
    for (const filePath of changedFiles) {
        // Check if this is in the packages directory
        if (filePath.startsWith(absolutePackagesDir)) {
            const pkgDir = getPackageForFile(filePath, packagesDir);
            if (pkgDir) {
                // Find the package by directory
                const pkg = packages.find(p => p.dir === pkgDir);
                if (pkg) {
                    if (isTestFile(filePath)) {
                        testChangedPackages.add(pkg.name);
                    } else {
                        sourceChangedPackages.add(pkg.name);
                    }
                    changedPackages.add(pkg.name);
                } else {
                    nonPackageFiles.push(filePath);
                }
            } else {
                nonPackageFiles.push(filePath);
            }
        }
    }
    
    // Log non-package files for debugging
    if (nonPackageFiles.length > 0 && nonPackageFiles.length <= 10) {
        console.log(`[git-aware] Non-package files ignored: ${nonPackageFiles.join(', ')}`);
    } else if (nonPackageFiles.length > 10) {
        console.log(`[git-aware] ${nonPackageFiles.length} non-package files ignored`);
    }
    
    // If only test files changed, just run tests for those packages
    let affectedPackages = Array.from(changedPackages);
    
    // If source files changed, include all dependent packages
    if (includeDependents && sourceChangedPackages.size > 0) {
        const allDependents = getDependentPackages(depGraph, Array.from(sourceChangedPackages));
        affectedPackages = Array.from(new Set([...changedPackages, ...allDependents]));
    }
    
    // Get test files for affected packages
    const affectedTestFiles = [];
    for (const pkgName of affectedPackages) {
        const pkg = packageMap.get(pkgName);
        if (pkg) {
            const testDir = path.join(pkg.dir, "test");
            if (fs.existsSync(testDir)) {
                const testFiles = getTestFilesInDirectory(testDir);
                affectedTestFiles.push(...testFiles);
            }
        }
    }
    
    // Calculate skipped packages
    const allPackageNames = new Set(packages.map(p => p.name));
    const skippedPackages = Array.from(allPackageNames).filter(
        pkgName => !affectedPackages.includes(pkgName)
    );
    
    return {
        changedFiles,
        base,
        changedPackages: Array.from(changedPackages),
        sourceChangedPackages: Array.from(sourceChangedPackages),
        testChangedPackages: Array.from(testChangedPackages),
        affectedPackages,
        affectedTestFiles,
        skippedPackages,
        skippedCount: skippedPackages.length,
        totalPackages: packages.length,
        reason: "Changes detected"
    };
}

/**
 * Get all test files in a directory recursively
 * @param {string} dir - Directory to search
 * @returns {Array} Array of test file paths
 */
function getTestFilesInDirectory(dir) {
    const testFiles = [];
    const testPatterns = [/test_.*\.ts$/, /test_.*\.js$/, /_test\.ts$/, /_test\.js$/];
    
    function walk(directory) {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                if (testPatterns.some(pattern => entry.name.match(pattern))) {
                    testFiles.push(fullPath);
                }
            }
        }
    }
    
    try {
        walk(dir);
    } catch (err) {
        console.warn(`[git-aware] Could not walk directory ${dir}: ${err.message}`);
    }
    
    return testFiles;
}

/**
 * Get a summary of the analysis
 * @param {Object} analysis - Analysis result from analyzeChanges
 * @returns {string} Human-readable summary
 */
function getAnalysisSummary(analysis) {
    const lines = [];
    
    lines.push("╔════════════════════════════════════════════════════════════════╗");
    lines.push("║                  GIT-AWARE TEST SELECTION                       ║");
    lines.push("╚════════════════════════════════════════════════════════════════╝");
    lines.push("");
    
    if (analysis.reason === "No changes detected") {
        lines.push("✓ No changes detected since last commit");
        lines.push("✓ All tests are up to date");
        lines.push("");
        lines.push("Run with --force or --all to run all tests anyway");
    } else if (analysis.reason === "Not a git repository") {
        lines.push("⚠ Not a git repository - running all tests");
    } else {
        lines.push(`Changed files: ${analysis.changedFiles.length}`);
        lines.push(`Changed packages: ${analysis.changedPackages.length}`);
        lines.push(`  Source packages: ${analysis.sourceChangedPackages.length}`);
        lines.push(`  Test-only packages: ${analysis.testChangedPackages.length}`);
        lines.push("");
        lines.push(`Affected packages: ${analysis.affectedPackages.length}`);
        lines.push(`  ${analysis.affectedPackages.join(", ")}`);
        lines.push("");
        lines.push(`✓ Will run tests for ${analysis.affectedPackages.length} packages`);
        lines.push(`✓ Skipping ${analysis.skippedCount} unchanged packages`);
        lines.push("");
        
        if (analysis.skippedCount > 0) {
            lines.push("Time saved: Estimated ~" + 
                Math.round((analysis.skippedCount / analysis.totalPackages * 100)) + 
                "% of test suite");
        }
    }
    
    lines.push("");
    return lines.join("\n");
}

/**
 * Check if there are any changes at all
 * @returns {boolean}
 */
function hasChanges(packagesDir = null, sinceRef = null) {
    const r = sinceRef ? getGitChangesSince(sinceRef, packagesDir) : getGitChanges(packagesDir);
    if (r.error) {
        throw new Error(`--since: ${r.error}`);
    }
    const { changedFiles, globalChanges } = r;
    return changedFiles.length > 0 || globalChanges.length > 0;
}

/**
 * Check if running in CI environment
 * @returns {boolean}
 */
function isCI() {
    return process.env.CI === "true" || 
           process.env.CONTINUOUS_INTEGRATION === "true" ||
           process.env.GITHUB_ACTIONS === "true" ||
           process.env.GITLAB_CI === "true";
}

module.exports = {
    analyzeChanges,
    getGitChanges,
    getGitChangesSince,
    getGitChangedFiles,
    getGitChangedFilesSince,
    getAllPackages,
    buildDependencyGraph,
    getDependentPackages,
    getAnalysisSummary,
    hasChanges,
    isCI,
    findRepoRoot,
    getPackageForFile
};

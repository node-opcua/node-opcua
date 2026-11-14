const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

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
    const repoRoot = findRepoRoot(packagesDir || process.cwd());
    if (!repoRoot) {
        return [];
    }

    // default to <repoRoot>/packages, overridable (e.g. the monorepo passes its own root)
    const dir = path.resolve(packagesDir || path.join(repoRoot, "packages"));
    const relDir = path.relative(repoRoot, dir) || ".";
    
    try {
        // Get staged and modified files (tracked files)
        const statusOutput = execSync(
            "git status --porcelain",
            { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        );
        
        // Get untracked files in the target directory only
        const untrackedInPackagesOutput = execSync(
            `git ls-files --others --exclude-standard -- ${relDir}/`,
            { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        );
        
        const changedFiles = [];
        
        // Parse git status output (format: "MM file\nA  file\n M file\n")
        if (statusOutput) {
            const lines = statusOutput.trim().split("\n");
            for (const line of lines) {
                if (line.trim()) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const file = parts.slice(1).join(" ");
                        if (file && !file.startsWith(".")) {
                            const fullPath = path.resolve(repoRoot, file);
                            // Only include files in packages directory
                            if (fullPath.startsWith(dir)) {
                                changedFiles.push(fullPath);
                            }
                        }
                    }
                }
            }
        }
        
        // Parse untracked files in packages directory
        if (untrackedInPackagesOutput) {
            const lines = untrackedInPackagesOutput.trim().split("\n");
            for (const line of lines) {
                if (line.trim() && !line.startsWith(".")) {
                    const fullPath = path.resolve(repoRoot, line.trim());
                    // Only include files in packages directory
                    if (fullPath.startsWith(dir)) {
                        changedFiles.push(fullPath);
                    }
                }
            }
        }
        
        return changedFiles;
    } catch (err) {
        console.warn(`[git-aware] Could not get git status: ${err.message}`);
        return [];
    }
}

/**
 * Get files changed since a specific commit (default: HEAD)
 * @param {string} commit - Commit hash or reference (default: HEAD)
 * @returns {Array} Array of changed file paths
 */
function getGitChangedFilesSince(commit = "HEAD", startDir = process.cwd()) {
    const repoRoot = findRepoRoot(startDir);
    if (!repoRoot) {
        return [];
    }
    
    try {
        const output = execSync(
            `git diff --name-only ${commit} --diff-filter=d`,
            { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        );
        
        const changedFiles = [];
        if (output) {
            const lines = output.trim().split("\n");
            for (const line of lines) {
                if (line.trim() && !line.startsWith(".")) {
                    changedFiles.push(path.resolve(repoRoot, line.trim()));
                }
            }
        }
        
        return changedFiles;
    } catch (err) {
        console.warn(`[git-aware] Could not get git diff: ${err.message}`);
        return [];
    }
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
    const changedFiles = sinceCommit 
        ? getGitChangedFilesSince(sinceCommit, absolutePackagesDir)
        : getGitChangedFiles(absolutePackagesDir);
    
    if (changedFiles.length === 0) {
        return {
            changedFiles: [],
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
function hasChanges(packagesDir = null) {
    const changedFiles = getGitChangedFiles(packagesDir);
    return changedFiles.length > 0;
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

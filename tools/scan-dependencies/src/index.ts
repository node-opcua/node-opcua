#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Types and interfaces
interface Package {
    name: string;
    path: string;
    packageJsonPath: string;
}

interface PackageJson {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    [key: string]: any;
}

// New type for missing dependency info with file tracking
interface MissingDependency {
    name: string;
    section: 'dependencies' | 'devDependencies';
    sourceFiles: string[];
    testFiles: string[];
}

// Parse command line arguments
const args = process.argv.slice(2);
const fixMode = args.includes('--fix');
const verbose = args.includes('--verbose');
const removeExtraneous = args.includes('--remove-extraneous');

function log(...args: any[]): void {
    if (verbose) {
        console.log(...args);
    }
}

function findPackages(): Package[] {
    const packagesDir = path.join(__dirname, '..', '..', '..', 'packages');
    const packages: Package[] = [];
    
    if (!fs.existsSync(packagesDir)) {
        console.error('Packages directory not found');
        process.exit(1);
    }
    
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('node-opcua-')) {
            const packagePath = path.join(packagesDir, entry.name);
            const packageJsonPath = path.join(packagePath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
                packages.push({
                    name: entry.name,
                    path: packagePath,
                    packageJsonPath
                });
            }
        }
    }
    
    return packages;
}

function findSourceDirectories(packagePath: string): string[] {
    const possibleDirs = ['source', 'src', 'sources', 'source_nodejs', 'test', 'tests', 'test_helpers', 'test_helper'];
    const found: string[] = [];
    
    for (const dir of possibleDirs) {
        const fullPath = path.join(packagePath, dir);
        if (fs.existsSync(fullPath)) {
            found.push(fullPath);
        }
    }
    
    return found;
}

function findSourceFiles(directory: string): { sourceFiles: string[], testFiles: string[] } {
    const sourceFiles: string[] = [];
    const testFiles: string[] = [];
    
    function scanDir(dir: string, isTest: boolean = false): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Check if this is a test directory
                const isTestDir = ['test', 'tests', 'test_helpers', 'test_helper'].includes(entry.name);
                
                // Skip node_modules and dist, but scan test directories
                if (!['node_modules', 'dist'].includes(entry.name)) {
                    scanDir(fullPath, isTest || isTestDir);
                }
            } else if ((entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) || 
                       entry.name.endsWith('.js') || 
                       entry.name.endsWith('.mjs')) {
                if (isTest) {
                    testFiles.push(fullPath);
                } else {
                    sourceFiles.push(fullPath);
                }
            }
        }
    }
    
    // Check if the directory itself is a test directory
    const dirName = path.basename(directory);
    const isTestDirectory = ['test', 'tests', 'test_helpers', 'test_helper'].includes(dirName);
    
    scanDir(directory, isTestDirectory);
    return { sourceFiles, testFiles };
}

function extractImports(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = new Set<string>();
    const ignoredImports = new Set<string>();
    
    // Match different import patterns
    const importPatterns = [
        // ES6 imports
        /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
        // CommonJS require
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        // Dynamic imports
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        // Re-exports (export * from)
        /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
        // Re-exports with specific exports
        /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g,
        // Re-exports with default
        /export\s+\{\s*default\s*\}\s+from\s+['"]([^'"]+)['"]/g
    ];
    
    for (const pattern of importPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            const moduleName = match[1];
            
            // Skip relative imports and absolute paths
            if (moduleName.startsWith('./') || 
                moduleName.startsWith('../') || 
                moduleName.startsWith('/')) {
                ignoredImports.add(moduleName);
                continue;
            }
            
            // Normalize package names
            const normalizedName = normalizePackageName(moduleName);
            imports.add(normalizedName);
        }
    }
    
    if (verbose && ignoredImports.size > 0) {
        log(`    Ignored local imports: ${Array.from(ignoredImports).join(', ')}`);
    }
    
    return Array.from(imports);
}

function normalizePackageName(moduleName: string): string {
    // Handle scoped packages (e.g., @foo/bar/stuff -> @foo/bar)
    if (moduleName.startsWith('@')) {
        const parts = moduleName.split('/');
        if (parts.length >= 2) {
            return `${parts[0]}/${parts[1]}`;
        }
        return moduleName;
    }
    
    // Handle regular packages with subpaths (e.g., node-opcua-crypto/web -> node-opcua-crypto)
    const parts = moduleName.split('/');
    return parts[0];
}

function readPackageJson(packageJsonPath: string): PackageJson | null {
    try {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(content) as PackageJson;
    } catch (error) {
        console.error(`Error reading package.json: ${packageJsonPath}`, (error as Error).message);
        return null;
    }
}

function getDependencies(packageJson: PackageJson): Set<string> {
    const deps = new Set<string>();
    
    if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => deps.add(dep));
    }
    
    return deps;
}

function getDevDependencies(packageJson: PackageJson): Set<string> {
    const deps = new Set<string>();
    
    if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => deps.add(dep));
    }
    
    return deps;
}

function getAllDependencies(packageJson: PackageJson): Set<string> {
    const deps = new Set<string>();
    
    if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => deps.add(dep));
    }
    
    if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => deps.add(dep));
    }
    
    if (packageJson.peerDependencies) {
        Object.keys(packageJson.peerDependencies).forEach(dep => deps.add(dep));
    }
    
    return deps;
}

// Updated function to find missing dependencies and their section with file tracking
function findMissingDependenciesDetailed(
    sourceImports: string[],
    testImports: string[],
    dependencies: Set<string>,
    devDependencies: Set<string>,
    sourceFileImports: Map<string, string[]>, // Map of import -> source files
    testFileImports: Map<string, string[]>    // Map of import -> test files
): MissingDependency[] {
    const missing: MissingDependency[] = [];
    const allImports = new Set([...sourceImports, ...testImports]);

    // Helper to check if a dep is present in any section
    const hasDep = (dep: string) => dependencies.has(dep) || devDependencies.has(dep);

    // Check for each import if it's missing and where it should go
    for (const importName of allImports) {
        if (!isExternalPackage(importName)) continue;
        if (hasDep(importName)) continue;

        const sourceFiles = sourceFileImports.get(importName) || [];
        const testFiles = testFileImports.get(importName) || [];

        // If used in source files, must be in dependencies
        if (sourceFiles.length > 0) {
            missing.push({ 
                name: importName, 
                section: 'dependencies',
                sourceFiles,
                testFiles
            });
        } else if (testFiles.length > 0) {
            missing.push({ 
                name: importName, 
                section: 'devDependencies',
                sourceFiles,
                testFiles
            });
        }
    }

    // Special type dependencies (e.g., @types/lodash)
    const specialTypeDependencies = getSpecialTypeDependencies([...allImports], new Set([...dependencies, ...devDependencies]));
    for (const dep of specialTypeDependencies) {
        const lodashSourceFiles = sourceFileImports.get('lodash') || [];
        const lodashTestFiles = testFileImports.get('lodash') || [];
        
        // If lodash is used in source, @types/lodash should be in dependencies, else in devDependencies
        if (lodashSourceFiles.length > 0) {
            if (!hasDep(dep)) {
                missing.push({ 
                    name: dep, 
                    section: 'dependencies',
                    sourceFiles: lodashSourceFiles,
                    testFiles: lodashTestFiles
                });
            }
        } else if (lodashTestFiles.length > 0) {
            if (!hasDep(dep)) {
                missing.push({ 
                    name: dep, 
                    section: 'devDependencies',
                    sourceFiles: lodashSourceFiles,
                    testFiles: lodashTestFiles
                });
            }
        }
    }

    return missing;
}

function getSpecialTypeDependencies(imports: string[], dependencies: Set<string>): string[] {
    const specialTypes: string[] = [];
    

    
    // Check each import for its corresponding @types package
    for (const [packageName, typePackage] of Object.entries(typeDependencies)) {
        if (imports.includes(packageName) && !dependencies.has(typePackage)) {
            specialTypes.push(typePackage);
        }
    }
    
    return specialTypes;
}

interface ExtraneousDependency {
    name: string;
    section: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

// Define type dependencies mapping for extraneous detection
const typeDependencies: Record<string, string> = {
    'lodash': '@types/lodash',
    'semver': '@types/semver',
    'mkdirp': '@types/mkdirp',
    'async': '@types/async',
    'underscore': '@types/underscore',
    'node': '@types/node'
};

function findExtraneousDependencies(sourceImports: string[], testImports: string[], dependencies: Set<string>, devDependencies: Set<string>): ExtraneousDependency[] {
    const extraneous: ExtraneousDependency[] = [];
    

    // Check dependencies (should be used in source files)
    for (const dep of dependencies) {
        if (!sourceImports.includes(dep)) {
            // Special case: @types packages should not be considered extraneous if their base package is present
            const isTypePackage = Object.values(typeDependencies).includes(dep);
            const basePackage = Object.keys(typeDependencies).find(key => typeDependencies[key] === dep);
            if (isTypePackage && basePackage && dependencies.has(basePackage)) {
                continue;
            }
            extraneous.push({ name: dep, section: 'dependencies' });
        }
    }
    
    // Check devDependencies (should be used in test files)
    for (const dep of devDependencies) {
        if (!testImports.includes(dep)) {
            // Special case: @types packages should not be considered extraneous if their base package is present
            const isTypePackage = Object.values(typeDependencies).includes(dep);
            const basePackage = Object.keys(typeDependencies).find(key => typeDependencies[key] === dep);
            if (isTypePackage && basePackage && (dependencies.has(basePackage) || testImports.includes(basePackage))) {
                continue;
            }
            extraneous.push({ name: dep, section: 'devDependencies' });
        }
    }
    
    return extraneous;
}

function isExternalPackage(moduleName: string): boolean {
    // Node.js built-in modules to ignore
    const builtInModules = [
        'fs', 'path', 'util', 'crypto', 'buffer', 'stream', 'events', 
        'http', 'https', 'net', 'tls', 'zlib', 'querystring', 'url', 
        'os', 'child_process', 'cluster', 'dgram', 'dns', 'domain', 
        'punycode', 'readline', 'repl', 'string_decoder', 'timers', 
        'tty', 'vm', 'worker_threads', 'assert', 'constants', 'module', 
        'process', 'v8', 'perf_hooks', 'trace_events', 'async_hooks', 
        'inspector', 'fs/promises', 'path/posix', 'path/win32', 
        'util/types', 'util/promises', 'usage'
    ];
    
    // Global test modules that don't need to be declared as dependencies
    const globalTestModules = [
        'should', 'sinon', 'mocha'
    ];
    
    // Ignore built-in Node.js modules and node:* modules
    if (builtInModules.includes(moduleName) || moduleName.startsWith('node:')) {
        return false;
    }
    
    // Ignore global test modules
    if (globalTestModules.includes(moduleName)) {
        return false;
    }
    
    // Ignore relative paths (should already be handled, but double-check)
    if (moduleName.startsWith('./') || moduleName.startsWith('../') || moduleName === '..') {
        return false;
    }
    
    // Check for node-opcua packages (local monorepo packages)
    if (moduleName.startsWith('node-opcua-')) {
        return true;
    }
    
    // Check for external npm packages (simple names without slashes)
    if (!moduleName.startsWith('@') && !moduleName.includes('/')) {
        return true;
    }
    
    // Check for scoped packages (like @ster5/global-mutex)
    if (moduleName.startsWith('@') && moduleName.split('/').length === 2) {
        return true;
    }
    
    return false;
}

function getLatestVersion(packageName: string): string {
    try {
        // Try to get version from the monorepo first
        const packagePath = path.join(__dirname, '..', '..', '..', 'packages', packageName);
        const packageJsonPath = path.join(packagePath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const pkg = readPackageJson(packageJsonPath);
            if (pkg && pkg.version) {
                return pkg.version;
            }
        }
        
        // Fallback to npm view
        const output = execSync(`npm view ${packageName} version`, { encoding: 'utf8' }).trim();
        return output;
    } catch (error) {
        log(`Warning: Could not determine version for ${packageName}`);
        return 'latest';
    }
}

function fixPackageJson(packageJsonPath: string, missingDependencies: string[]): boolean {
    const packageJson = readPackageJson(packageJsonPath);
    if (!packageJson) return false;
    
    let modified = false;
    
    if (!packageJson.dependencies) {
        packageJson.dependencies = {};
    }
    
    for (const dep of missingDependencies) {
        const version = getLatestVersion(dep);
        packageJson.dependencies[dep] = version;
        console.log(`  + Adding ${dep}@${version} to dependencies`);
        modified = true;
    }
    
    if (modified) {
        // Sort dependencies alphabetically
        packageJson.dependencies = Object.keys(packageJson.dependencies)
            .sort()
            .reduce((obj, key) => {
                obj[key] = packageJson.dependencies![key];
                return obj;
            }, {} as Record<string, string>);
        
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
        return true;
    }
    
    return false;
}

function fixDevDependencies(packageJsonPath: string, missingDevDependencies: string[]): boolean {
    const packageJson = readPackageJson(packageJsonPath);
    if (!packageJson) return false;
    
    let modified = false;
    
    if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
    }
    
    for (const dep of missingDevDependencies) {
        const version = getLatestVersion(dep);
        packageJson.devDependencies[dep] = version;
        console.log(`  + Adding ${dep}@${version} to devDependencies`);
        modified = true;
    }
    
    if (modified) {
        // Sort devDependencies alphabetically
        packageJson.devDependencies = Object.keys(packageJson.devDependencies)
            .sort()
            .reduce((obj, key) => {
                obj[key] = packageJson.devDependencies![key];
                return obj;
            }, {} as Record<string, string>);
        
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
        return true;
    }
    
    return false;
}

function removeExtraneousDependencies(packageJsonPath: string, extraneousDependencies: string[]): boolean {
    const packageJson = readPackageJson(packageJsonPath);
    if (!packageJson) return false;
    
    let modified = false;
    
    // Remove from dependencies
    if (packageJson.dependencies) {
        for (const dep of extraneousDependencies) {
            if (packageJson.dependencies[dep]) {
                delete packageJson.dependencies[dep];
                console.log(`  - Removing ${dep} from dependencies`);
                modified = true;
            }
        }
    }
    
    // Remove from devDependencies
    if (packageJson.devDependencies) {
        for (const dep of extraneousDependencies) {
            if (packageJson.devDependencies[dep]) {
                delete packageJson.devDependencies[dep];
                console.log(`  - Removing ${dep} from devDependencies`);
                modified = true;
            }
        }
    }
    
    // Remove from peerDependencies
    if (packageJson.peerDependencies) {
        for (const dep of extraneousDependencies) {
            if (packageJson.peerDependencies[dep]) {
                delete packageJson.peerDependencies[dep];
                console.log(`  - Removing ${dep} from peerDependencies`);
                modified = true;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
        return true;
    }
    
    return false;
}

function main(): void {
    console.log('Scanning node-opcua monorepo for missing dependencies...\n');
    
    const packages = findPackages();
    let totalIssues = 0;
    let totalFixed = 0;
    let totalExtraneous = 0;
    let totalRemoved = 0;
    
    for (const pkg of packages) {
        log(`\nProcessing package: ${pkg.name}`);
        
        const sourceDirs = findSourceDirectories(pkg.path);
        if (sourceDirs.length === 0) {
            log(`  No source directories found for ${pkg.name}`);
            continue;
        }
        
        const allImports = new Set<string>();
        const testImports = new Set<string>();
        const sourceImports = new Set<string>();
        
        // Track which files import each dependency
        const sourceFileImports = new Map<string, string[]>(); // import -> source files
        const testFileImports = new Map<string, string[]>();   // import -> test files
        
        for (const sourceDir of sourceDirs) {
            log(`  Scanning directory: ${sourceDir}`);
            const { sourceFiles, testFiles } = findSourceFiles(sourceDir);
            log(`  Found ${sourceFiles.length} source files (TS/JS) and ${testFiles.length} test files (TS/JS)`);
            
            // Process source files
            for (const file of sourceFiles) {
                const imports = extractImports(file);
                imports.forEach(imp => {
                    allImports.add(imp);
                    sourceImports.add(imp);
                    
                    // Track which file imports this dependency
                    if (!sourceFileImports.has(imp)) {
                        sourceFileImports.set(imp, []);
                    }
                    sourceFileImports.get(imp)!.push(file);
                });
            }
            
            // Process test files
            for (const file of testFiles) {
                const imports = extractImports(file);
                imports.forEach(imp => {
                    allImports.add(imp);
                    testImports.add(imp);
                    
                    // Track which file imports this dependency
                    if (!testFileImports.has(imp)) {
                        testFileImports.set(imp, []);
                    }
                    testFileImports.get(imp)!.push(file);
                });
            }
        }
        
        const packageJson = readPackageJson(pkg.packageJsonPath);
        if (!packageJson) continue;
        
        const dependencies = getDependencies(packageJson);
        const devDependencies = getDevDependencies(packageJson);
        
        // --- NEW: Use improved missing dependency detection with file tracking ---
        const missingDetailed = findMissingDependenciesDetailed(
            Array.from(sourceImports),
            Array.from(testImports),
            dependencies,
            devDependencies,
            sourceFileImports,
            testFileImports
        );
        // --- END NEW ---
        
        // Check for extraneous dependencies (considering source and test imports separately)
        const extraneousDependencies = findExtraneousDependencies(Array.from(sourceImports), Array.from(testImports), dependencies, devDependencies);
        
        let hasIssues = false;
        
        if (missingDetailed.length > 0) {
            console.log(`\n❌ ${pkg.name}: Missing dependencies:`);
            // Group by section
            const bySection = missingDetailed.reduce((acc, dep) => {
                if (!acc[dep.section]) acc[dep.section] = [];
                acc[dep.section].push(dep);
                return acc;
            }, {} as Record<'dependencies' | 'devDependencies', MissingDependency[]>);
            
            if (bySection.dependencies && bySection.dependencies.length > 0) {
                console.log(`  dependencies:`);
                bySection.dependencies.forEach(dep => {
                    console.log(`    - ${dep.name}`);
                    if (dep.sourceFiles.length > 0) {
                        console.log(`      Used in source files:`);
                        dep.sourceFiles.forEach(file => {
                            const relativePath = path.relative(pkg.path, file);
                            console.log(`        ${relativePath}`);
                        });
                    }
                    if (dep.testFiles.length > 0) {
                        console.log(`      Also used in test files:`);
                        dep.testFiles.forEach(file => {
                            const relativePath = path.relative(pkg.path, file);
                            console.log(`        ${relativePath}`);
                        });
                    }
                });
            }
            if (bySection.devDependencies && bySection.devDependencies.length > 0) {
                console.log(`  devDependencies:`);
                bySection.devDependencies.forEach(dep => {
                    console.log(`    - ${dep.name}`);
                    if (dep.testFiles.length > 0) {
                        console.log(`      Used in test files:`);
                        dep.testFiles.forEach(file => {
                            const relativePath = path.relative(pkg.path, file);
                            console.log(`        ${relativePath}`);
                        });
                    }
                });
            }
            totalIssues += missingDetailed.length;
            hasIssues = true;
            
            if (fixMode) {
                // Add to correct section
                const depsToAdd = bySection.dependencies?.map(d => d.name) || [];
                const devDepsToAdd = bySection.devDependencies?.map(d => d.name) || [];
                if (depsToAdd.length > 0) {
                    console.log(`  🔧 Adding missing dependencies to dependencies...`);
                    if (fixPackageJson(pkg.packageJsonPath, depsToAdd)) {
                        totalFixed += depsToAdd.length;
                        console.log(`  ✅ Added ${depsToAdd.length} missing dependencies`);
                    }
                }
                if (devDepsToAdd.length > 0) {
                    console.log(`  🔧 Adding missing dependencies to devDependencies...`);
                    if (fixDevDependencies(pkg.packageJsonPath, devDepsToAdd)) {
                        totalFixed += devDepsToAdd.length;
                        console.log(`  ✅ Added ${devDepsToAdd.length} missing devDependencies`);
                    }
                }
            }
        }
        
        if (extraneousDependencies.length > 0) {
            console.log(`\n⚠️  ${pkg.name}: Extraneous dependencies:`);
            
            // Group by section for better display
            const bySection = extraneousDependencies.reduce((acc, dep) => {
                if (!acc[dep.section]) {
                    acc[dep.section] = [];
                }
                acc[dep.section].push(dep.name);
                return acc;
            }, {} as Record<string, string[]>);
            
            // Display dependencies section
            if (bySection.dependencies && bySection.dependencies.length > 0) {
                console.log(`  Dependencies (not used in source files):`);
                bySection.dependencies.forEach(dep => console.log(`    - ${dep}`));
            }
            
            // Display devDependencies section
            if (bySection.devDependencies && bySection.devDependencies.length > 0) {
                console.log(`  DevDependencies (not used in test files):`);
                bySection.devDependencies.forEach(dep => console.log(`    - ${dep}`));
            }
            
            totalExtraneous += extraneousDependencies.length;
            hasIssues = true;
            
            if (removeExtraneous) {
                console.log(`  🔧 Removing extraneous dependencies...`);
                const depNames = extraneousDependencies.map(dep => dep.name);
                if (removeExtraneousDependencies(pkg.packageJsonPath, depNames)) {
                    totalRemoved += extraneousDependencies.length;
                    console.log(`  ✅ Removed ${extraneousDependencies.length} extraneous dependencies`);
                }
            }
        }
        
        if (!hasIssues) {
            log(`  ✅ ${pkg.name}: All dependencies are properly declared`);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total packages scanned: ${packages.length}`);
    console.log(`  Total missing dependencies found: ${totalIssues}`);
    console.log(`  Total extraneous dependencies found: ${totalExtraneous}`);
    
    if (fixMode) {
        console.log(`  Total dependencies added: ${totalFixed}`);
        if (totalFixed > 0) {
            console.log(`\n💡 Run 'npm install' in the root directory to install the new dependencies.`);
        }
    }
    
    if (removeExtraneous) {
        console.log(`  Total dependencies removed: ${totalRemoved}`);
        if (totalRemoved > 0) {
            console.log(`\n💡 Run 'npm install' in the root directory to clean up removed dependencies.`);
        }
    }
    
    if (totalIssues === 0 && totalExtraneous === 0) {
        console.log(`\n🎉 All packages have properly declared dependencies!`);
    } else if (totalIssues > 0 || totalExtraneous > 0) {
        console.log(`\n💡 Run with --fix to add missing dependencies and --remove-extraneous to remove unused dependencies.`);
    }
}

// Export functions for testing
export {
    findPackages,
    findSourceDirectories,
    findSourceFiles,
    extractImports,
    findMissingDependenciesDetailed,
    findExtraneousDependencies,
    getDependencies,
    getDevDependencies,
    getAllDependencies,
    Package,
    PackageJson,
    ExtraneousDependency
};

// Run main function if this file is executed directly
if (require.main === module) {
    main();
} 

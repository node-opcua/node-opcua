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

// Parse command line arguments
const args = process.argv.slice(2);
const fixMode = args.includes('--fix');
const verbose = args.includes('--verbose');

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
    const possibleDirs = ['source', 'src', 'sources'];
    const found: string[] = [];
    
    for (const dir of possibleDirs) {
        const fullPath = path.join(packagePath, dir);
        if (fs.existsSync(fullPath)) {
            found.push(fullPath);
        }
    }
    
    return found;
}

function findTypeScriptFiles(directory: string): string[] {
    const files: string[] = [];
    
    function scanDir(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules, dist, test directories
                if (!['node_modules', 'dist', 'test', 'tests', 'test_helpers'].includes(entry.name)) {
                    scanDir(fullPath);
                }
            } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }
    }
    
    scanDir(directory);
    return files;
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
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
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
    
    if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach(dep => deps.add(dep));
    }
    
    if (packageJson.peerDependencies) {
        Object.keys(packageJson.peerDependencies).forEach(dep => deps.add(dep));
    }
    
    return deps;
}

function findMissingDependencies(imports: string[], dependencies: Set<string>): string[] {
    const missing: string[] = [];
    
    for (const importName of imports) {
        // Check if the import is a node-opcua package or external npm package
        if (isExternalPackage(importName) && !dependencies.has(importName)) {
            missing.push(importName);
        }
    }
    
    return missing;
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
    
    // Ignore built-in Node.js modules and node:* modules
    if (builtInModules.includes(moduleName) || moduleName.startsWith('node:')) {
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

function main(): void {
    console.log('Scanning node-opcua monorepo for missing dependencies...\n');
    
    const packages = findPackages();
    let totalIssues = 0;
    let totalFixed = 0;
    
    for (const pkg of packages) {
        log(`\nProcessing package: ${pkg.name}`);
        
        const sourceDirs = findSourceDirectories(pkg.path);
        if (sourceDirs.length === 0) {
            log(`  No source directories found for ${pkg.name}`);
            continue;
        }
        
        const allImports = new Set<string>();
        
        for (const sourceDir of sourceDirs) {
            log(`  Scanning directory: ${sourceDir}`);
            const tsFiles = findTypeScriptFiles(sourceDir);
            log(`  Found ${tsFiles.length} TypeScript files`);
            
            for (const file of tsFiles) {
                const imports = extractImports(file);
                imports.forEach(imp => allImports.add(imp));
            }
        }
        
        const packageJson = readPackageJson(pkg.packageJsonPath);
        if (!packageJson) continue;
        
        const dependencies = getDependencies(packageJson);
        const missingDependencies = findMissingDependencies(Array.from(allImports), dependencies);
        
        if (missingDependencies.length > 0) {
            console.log(`\n❌ ${pkg.name}: Missing dependencies:`);
            missingDependencies.forEach(dep => console.log(`  - ${dep}`));
            totalIssues += missingDependencies.length;
            
            if (fixMode) {
                console.log(`  🔧 Fixing package.json...`);
                if (fixPackageJson(pkg.packageJsonPath, missingDependencies)) {
                    totalFixed += missingDependencies.length;
                    console.log(`  ✅ Fixed ${missingDependencies.length} missing dependencies`);
                }
            }
        } else {
            log(`  ✅ ${pkg.name}: All dependencies are properly declared`);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total packages scanned: ${packages.length}`);
    console.log(`  Total missing dependencies found: ${totalIssues}`);
    
    if (fixMode) {
        console.log(`  Total dependencies fixed: ${totalFixed}`);
        if (totalFixed > 0) {
            console.log(`\n💡 Run 'npm install' in the root directory to install the new dependencies.`);
        }
    } else if (totalIssues > 0) {
        console.log(`\n💡 Run with --fix to automatically add missing dependencies to package.json files.`);
    }
    
    if (totalIssues === 0) {
        console.log(`\n🎉 All packages have properly declared dependencies!`);
    }
}

// Export functions for testing
export {
    findPackages,
    findSourceDirectories,
    findTypeScriptFiles,
    extractImports,
    findMissingDependencies,
    Package,
    PackageJson
};

// Run main function if this file is executed directly
if (require.main === module) {
    main();
} 
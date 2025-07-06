import * as fs from 'fs';
import * as path from 'path';

interface Package {
    name: string;
    path: string;
    packageJsonPath: string;
}

interface DependencyGraph {
    [packageName: string]: string[];
}

interface Cycle {
    path: string[];
    packages: string[];
}

function findPackages(): Package[] {
    const packages: Package[] = [];
    const packagesDir = path.join(__dirname, '..', '..', '..', 'packages');
    
    if (!fs.existsSync(packagesDir)) {
        console.error('Packages directory not found');
        return packages;
    }
    
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
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

function readPackageJson(packageJsonPath: string): any {
    try {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading package.json: ${packageJsonPath}`, (error as Error).message);
        return null;
    }
}

function extractNodeOpcuaDependencies(packageJson: any): string[] {
    const dependencies: string[] = [];
    
    // Check dependencies
    if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep: string) => {
            if (dep === 'node-opcua' || dep.startsWith('node-opcua-')) {
                dependencies.push(dep);
            }
        });
    }
    
    // Check devDependencies
    if (packageJson.devDependencies) {
        Object.keys(packageJson.devDependencies).forEach((dep: string) => {
            if (dep === 'node-opcua' || dep.startsWith('node-opcua-')) {
                dependencies.push(dep);
            }
        });
    }
    
    // Check peerDependencies
    if (packageJson.peerDependencies) {
        Object.keys(packageJson.peerDependencies).forEach((dep: string) => {
            if (dep === 'node-opcua' || dep.startsWith('node-opcua-')) {
                dependencies.push(dep);
            }
        });
    }
    
    // Debug output
    if (packageJson.name === 'node-opcua-schemas') {
        console.log('DEBUG: node-opcua-schemas dependencies:', dependencies);
        console.log('DEBUG: node-opcua-schemas devDependencies:', packageJson.devDependencies);
    }
    
    return dependencies;
}

function buildDependencyGraph(): DependencyGraph {
    const packages = findPackages();
    const graph: DependencyGraph = {};
    
    for (const pkg of packages) {
        const packageJson = readPackageJson(pkg.packageJsonPath);
        if (packageJson) {
            graph[pkg.name] = extractNodeOpcuaDependencies(packageJson);
        }
    }
    
    return graph;
}

function findCycles(graph: DependencyGraph): Cycle[] {
    const cycles: Cycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    function dfs(node: string, path: string[]): void {
        if (recursionStack.has(node)) {
            // Found a cycle
            const cycleStart = path.indexOf(node);
            const cyclePath = path.slice(cycleStart);
            cycles.push({
                path: cyclePath,
                packages: cyclePath
            });
            return;
        }
        
        if (visited.has(node)) {
            return;
        }
        
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        
        const neighbors = graph[node] || [];
        for (const neighbor of neighbors) {
            dfs(neighbor, [...path]);
        }
        
        recursionStack.delete(node);
    }
    
    for (const node of Object.keys(graph)) {
        if (!visited.has(node)) {
            dfs(node, []);
        }
    }
    
    return cycles;
}

function analyzeCycles(cycles: Cycle[]): void {
    console.log('🔍 Analyzing cyclic dependencies in node-opcua monorepo...\n');
    
    if (cycles.length === 0) {
        console.log('✅ No cyclic dependencies found!');
        return;
    }
    
    console.log(`❌ Found ${cycles.length} cyclic dependency chain(s):\n`);
    
    for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        console.log(`Cycle ${i + 1}:`);
        console.log(`  ${cycle.packages.join(' → ')} → ${cycle.packages[0]}`);
        console.log('');
    }
    
    console.log('💡 Recommendations to break cycles:');
    console.log('');
    
    // Analyze each cycle and provide recommendations
    for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        console.log(`Cycle ${i + 1} recommendations:`);
        
        // Find the package with the most dependencies (potential candidate for refactoring)
        const packageDependencyCounts = cycle.packages.map(pkg => ({
            package: pkg,
            count: cycle.packages.filter(other => 
                other !== pkg && cycle.packages.includes(other)
            ).length
        }));
        
        const mostDependent = packageDependencyCounts.reduce((max, current) => 
            current.count > max.count ? current : max
        );
        
        console.log(`  - Consider refactoring ${mostDependent.package} to reduce its dependencies`);
        console.log(`  - Look for shared utilities that could be extracted to a common package`);
        console.log(`  - Consider if any dependencies can be moved to devDependencies`);
        console.log('');
    }
    
    console.log('🔧 General strategies:');
    console.log('  1. Extract shared utilities to a common package (e.g., node-opcua-common)');
    console.log('  2. Use dependency injection or interfaces to reduce coupling');
    console.log('  3. Move test-only dependencies to devDependencies');
    console.log('  4. Consider if some packages can be merged or split differently');
    console.log('  5. Use peerDependencies for optional dependencies');
}

function main(): void {
    const graph = buildDependencyGraph();
    const cycles = findCycles(graph);
    analyzeCycles(cycles);
    
    // Also show the full dependency graph for reference
    console.log('\n📊 Full dependency graph (node-opcua packages only):');
    console.log('');
    for (const [pkg, deps] of Object.entries(graph)) {
        if (deps.length > 0) {
            console.log(`${pkg}:`);
            deps.forEach(dep => console.log(`  - ${dep}`));
            console.log('');
        }
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export { findPackages, buildDependencyGraph, findCycles, analyzeCycles }; 
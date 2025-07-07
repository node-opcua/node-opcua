const fs = require('fs');
const path = require('path');

// Test the extractImports function
function extractImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = new Set();
    const ignoredImports = new Set();
    
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
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const moduleName = match[1];
            
            // Skip relative imports and absolute paths
            if (moduleName.startsWith('./') || 
                moduleName.startsWith('../') || 
                moduleName.startsWith('/')) {
                ignoredImports.add(moduleName);
                continue;
            }
            
            imports.add(moduleName);
        }
    }
    
    return Array.from(imports);
}

// Test with the actual file
const testFile = path.join(__dirname, '../../packages/node-opcua-basic-types/source/date_time.ts');
console.log('Testing re-export detection...');
console.log('File:', testFile);
console.log('Content:');
console.log(fs.readFileSync(testFile, 'utf8'));
console.log('\nDetected imports:');
console.log(extractImports(testFile)); 
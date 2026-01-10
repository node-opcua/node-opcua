const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, 'packages');

// 1. Identify all local packages in packages/ directory
const localPackages = new Set();
try {
    const items = fs.readdirSync(packagesDir);
    for (const item of items) {
        if (item.startsWith('node-opcua')) {
            const fullPath = path.join(packagesDir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                // Check if it has a package.json
                if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                    localPackages.add(item);
                }
            }
        }
    }
} catch (err) {
    console.error("Error reading packages directory:", err);
    process.exit(1);
}

console.log(`Found ${localPackages.size} local node-opcua packages.`);

// 2. Iterate and update each package.json
let modifiedCount = 0;

function findModuleVersion(moduleName) {
    const pkgJsonPath = path.join(packagesDir, moduleName, 'package.json');
    try {
        const content = fs.readFileSync(pkgJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        return pkg.version || "*";
    }
    catch (err) {
        console.error(`Cannot find version for module ${moduleName}:`, err);
        return "*";
    }
}
for (const pkgName of localPackages) {
    const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
    
    try {
        const content = fs.readFileSync(pkgJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        let changed = false;

        const updateDependencies = (deps) => {
            if (!deps) return false;
            let modified = false;
            for (const depName in deps) {
                if (localPackages.has(depName)) {
                    // Check if it is alrea dy a file: reference
                    const newValue1 = "*";
                    const newValue2 = `file:../${depName}`;
                    /* new value3 is the actual version of the dependent module,(localphack) */
                    const newValue3 = findModuleVersion(depName);
                    const newValue = newValue3;
                    if (deps[depName] !== newValue) {
                        console.log(`[${pkgName}] Updating ${depName}: ${deps[depName]} -> ${newValue}`);
                        deps[depName] = newValue;
                        modified = true;
                    }
                }
            }
            return modified;
        };

        if (updateDependencies(pkg.dependencies)) changed = true;
        if (updateDependencies(pkg.devDependencies)) changed = true;
        if (updateDependencies(pkg.peerDependencies)) changed = true;

        if (changed) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 4) + '\n', 'utf8');
            modifiedCount++;
        }

    } catch (err) {
        console.error(`Error processing ${pkgName}:`, err);
    }
}

console.log(`Finished. Modified ${modifiedCount} package.json files.`);

#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import { fileURLToPath } from 'url';

// Function to scan directories and process files
function scanDirectories(rootDir, callback) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    entries.forEach(entry => {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            scanDirectories(fullPath, callback);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            callback(fullPath);
        }
    });
}

// Function to extract node-opcua-* modules from a file
function extractModules(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /from\s+"(node-opcua[^"]+)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        matches.push(match[1].split('/')[0]); // Take only the base module name
    }
    return [...new Set(matches)]; // Remove duplicates
}

// Main function to scan and extract modules
function extractAll() {
    const rootDirs = ['source', 'src', 'source_nodejs', "test_helpers", "bin"];
    const modules = new Set();

    rootDirs.forEach(rootDir => {
        if (fs.existsSync(rootDir)) {
            scanDirectories(rootDir, (filePath) => {
                extractModules(filePath).forEach(module => modules.add(module));
            });
        }
    });

    // Convert the Set to an array and sort it
    return Array.from(modules).sort();
}

// Function to update the references section of tsconfig.json
function updateTsConfigReferences(tsConfigPath, modules) {


    const content = fs.readFileSync(tsConfigPath, 'utf8');
    const tsConfig = JSON5.parse(content);

    // Filter modules to only include those with existing directories
    const validModules = modules.filter(module => {
        const modulePath = path.join(process.cwd(), '..', module);
        return fs.existsSync(modulePath);
    });

    // Update references
    tsConfig.references = validModules.map(module => ({ path: `../${module}` }));

    tsConfig["extends"] = "../tsconfig.common.json";

    // Write the updated tsconfig back to the file
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 4));
}

function main() {

   
    try {
        let tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
        console.log(" ====> current folder:", process.cwd());
        console.log(" ====> tsConfigPath", tsConfigPath);
        // return;
        // Check if the tsconfig.json path is provided as an argument
        // Use tsconfig_base.json for specific packages, otherwise default to tsconfig.json
        const specialPackages = [
            "node-opcua-address-space",
            "node-opcua-debug",
            "node-opcua-modeler"
        ];
        const currentName = path.basename(process.cwd());
        if (process.argv.length < 3 && specialPackages.includes(currentName)) {
            tsConfigPath = path.join(process.cwd(), 'tsconfig_base.json');
        } else if (process.argv.length >= 3) {
            tsConfigPath = process.argv[2];
        }

        const sortedModules = extractAll();
        console.log("Extracted modules:", sortedModules);
        updateTsConfigReferences(tsConfigPath, sortedModules);
    } catch (error) {
        console.error("Error during extraction:", error.message);
        console.log("current folder:", process.cwd());
        process.exit(1);
    }
}
main();

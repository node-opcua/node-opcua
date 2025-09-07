const fs = require('fs');
const rimraf = require('rimraf');
const path = require('path');

console.log("Starting cleanup process...");

// Function to get directories
function getDirectories(srcPath) {
    console.log(`Reading directories from: ${srcPath}`);
    const contents = fs.readdirSync(srcPath);
    const directories = contents.filter(file => {
        const filePath = path.join(srcPath, file);
        return fs.statSync(filePath).isDirectory();
    });
    console.log(`Found directories: ${directories.join(', ')}`);
    return directories;
}

// Function to get files matching a pattern in a directory
function getFilesMatchingPattern(dir, pattern) {
    console.log(`Searching for files matching pattern: ${pattern} in directory: ${dir}`);
    const files = fs.readdirSync(dir).filter(file => {
        return file.match(new RegExp(pattern));
    });
    console.log(`Found files: ${files.join(', ')}`);
    return files;
}

// Path to the packages directory, relative to the script's location
const packagesDir = path.join(__dirname, '../../packages');
console.log(`Targeting packages directory: ${packagesDir}`);

// Get all directories in the packages directory
const directories = getDirectories(packagesDir);

// Iterate over each directory
directories.forEach(dir => {
    const dirPath = path.join(packagesDir, dir);
    console.log(`\nProcessing directory: ${dirPath}`);

    // Remove node_modules
    removeFolder(dirPath, "node_modules");


    // Remove dist
    removeFolder(dirPath, "dist");
    removeFolder(dirPath, "distHelpers");
    removeFolder(dirPath, "distNodeJs");

    // Remove tmp
    removeFolder(dirPath, "tmp");
    // Remove .tsbuildinfo files
    const tsbuildinfoFiles = getFilesMatchingPattern(dirPath, /\.tsbuildinfo$/);
    tsbuildinfoFiles.forEach(file => {
        const filePath = path.join(dirPath, file);
        console.log(`Removing file: ${filePath}`);
        rimraf.sync(filePath);
        console.log(`Successfully removed ${file}`);
    });
});

console.log("\nCleanup process completed.");
function removeFolder(dirPath, folderName) {
    const distPath = path.join(dirPath, folderName);
    if (fs.existsSync(distPath)) {
        console.log(`Removing ${folderName} at: ${distPath}`);
        rimraf.sync(distPath);
        console.log(`Successfully removed ${folderName}`);
    } else {
        console.log(`No ${folderName} directory found`);
    }
}


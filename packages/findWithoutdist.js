const fs = require('fs');
const path = require('path');

// Function to check if a directory contains a 'dist' subdirectory
function hasDistFolder(dirPath) {
  const contents = fs.readdirSync(dirPath);
  return contents.includes('dist') && fs.statSync(path.join(dirPath, 'dist')).isDirectory();
}

// Get all items in the current directory
const currentDir = process.cwd();
const items = fs.readdirSync(currentDir);

// Filter out only the directories
const directories = items.filter(item => {
  const itemPath = path.join(currentDir, item);
  return fs.statSync(itemPath).isDirectory();
});

// Check each directory for the absence of a 'dist' subdirectory
const directoriesWithoutDist = directories.filter(dir => {
  const dirPath = path.join(currentDir, dir);
  return !hasDistFolder(dirPath);
});

// Output the results
console.log("Directories without a 'dist' subfolder:");
directoriesWithoutDist.forEach(dir => {
  console.log(dir);
});


const fs = require('fs');
const path = require('path');
const published = [];
function findPackages(dir, targetName, targetVersion) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && file.startsWith(targetName)) {
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.version === targetVersion) {
          console.log(fullPath);
          //  run the npm publish command from the full path directory as cwd
          const { execSync } = require('child_process');

          try {
            execSync('npm publish', { stdio: 'inherit', cwd: fullPath });
            console.log('Published ' + fullPath);
            published.push(fullPath);
          } catch (error) {
            console.error('Failed to publish ' + fullPath);
            console.error(error);
          }

        }
        // console.log(fullPath, packageJson.version);
      }
    }
  }
  console.log('Published packages: ' + published);
}

findPackages('packages', 'node-opcua', '2.159.0');

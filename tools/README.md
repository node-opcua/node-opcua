# Node-OPCUA Tools

This directory contains development tools for the node-opcua monorepo.

## Available Tools

### scan-dependencies

A TypeScript tool to scan the monorepo for missing dependencies in package.json files. The tool intelligently ignores local imports (`./` and `../`), built-in Node.js modules, and `node:` protocol modules, and normalizes package names (e.g., `node-opcua-crypto/web` → `node-opcua-crypto`), focusing only on external package dependencies.

**Quick Start:**
```bash
# Build the tool
cd tools/scan-dependencies
npm install
npm run build

# Run from tools directory
cd ../..
node tools/scan-deps.js

# Or run directly
cd tools/scan-dependencies
npm run scan
```

**Usage:**
```bash
# Scan for missing dependencies (read-only)
node tools/scan-deps.js

# Scan and fix missing dependencies
node tools/scan-deps.js --fix

# Verbose output
node tools/scan-deps.js --verbose
```

For more details, see [scan-dependencies/README.md](scan-dependencies/README.md).

### Other Tools

- `clean/`: Cleanup utilities
- `fix-tsconfigs/`: TypeScript configuration fixes

## Directory Structure

```
tools/
├── scan-dependencies/     # Dependency scanning tool
├── clean/                # Cleanup utilities
├── fix-tsconfigs/        # TypeScript config fixes
├── scan-deps.js          # Launcher for scan-dependencies
└── README.md            # This file
``` 
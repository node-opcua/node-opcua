# Node-OPCUA Tools

This directory contains development tools for the node-opcua monorepo.

## Available Tools

### scan-dependencies

A TypeScript tool to scan the monorepo for missing dependencies in package.json files. The tool intelligently ignores local imports (`./` and `../`), built-in Node.js modules, and `node:` protocol modules, normalizes package names (e.g., `node-opcua-crypto/web` → `node-opcua-crypto`), and automatically includes required type definitions (e.g., `@types/lodash` when `lodash` is used), focusing only on external package dependencies.

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

# Scan and remove extraneous dependencies
node tools/scan-deps.js --remove-extraneous

# Scan and fix both missing and extraneous dependencies
node tools/scan-deps.js --fix --remove-extraneous

# Verbose output
node tools/scan-deps.js --verbose
```

For more details, see [scan-dependencies/README.md](scan-dependencies/README.md).

### check-debug-log

Finds debug log calls that are not guarded by a debug flag. `make_debugLog()` tests the
flag *inside* the returned function, so arguments — template literals, chalk chains,
`.toString()` calls — are evaluated on every call even with debugging off.

```bash
# report; exits non-zero if anything is unguarded, so it works as a CI gate
node tools/check-debug-log.js

# list every site, or scope to one package
node tools/check-debug-log.js --verbose
node tools/check-debug-log.js --package node-opcua-server

# rewrite them into `if (doDebug) { ... }` blocks
node tools/check-debug-log.js --fix
```

For more details, see [check-debug-log/README.md](check-debug-log/README.md).

### check-mocharc

Keeps every package's mocha configuration on one shape that survives pnpm's layout:
spread `packages/.mocharc.js`, override only what differs, never write a relative path
into `require`.

```bash
pnpm run check:mocharc          # report, exit 1 if anything is off-pattern
pnpm run check:mocharc:fix      # rewrite to the canonical shape
```

For more details, see [check-mocharc/README.md](check-mocharc/README.md).

### Other Tools

- `clean/`: Cleanup utilities
- `fix-tsconfigs/`: TypeScript configuration fixes

## Directory Structure

```
tools/
├── scan-dependencies/     # Dependency scanning tool
├── check-debug-log/       # Unguarded debug-log finder / fixer
├── check-mocharc/         # Mocha config shape checker / fixer
├── clean/                # Cleanup utilities
├── fix-tsconfigs/        # TypeScript config fixes
├── scan-deps.js          # Launcher for scan-dependencies
├── check-debug-log.js    # Launcher for check-debug-log
├── check-mocharc.js      # Launcher for check-mocharc
└── README.md            # This file
``` 
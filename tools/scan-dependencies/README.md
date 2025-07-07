# Node-OPCUA Dependency Scanner

A TypeScript tool to scan the node-opcua monorepo for missing dependencies in package.json files.

## Features

- 🔍 **Comprehensive Scanning**: Scans all TypeScript files in `source/`, `src/`, or `sources/` directories
- 📦 **Import Detection**: Identifies ES6 imports, CommonJS require, and dynamic imports
- 🔧 **Auto-fix**: Automatically adds missing dependencies to package.json files
- 📊 **Detailed Reporting**: Provides summary statistics and verbose output options
- 🎯 **Monorepo Aware**: Understands node-opcua package structure and versioning

## Installation

```bash
cd tools/scan-dependencies
npm install
npm run build
```

## Usage

### Basic scan (read-only)
```bash
npm run scan
```

### Scan and fix missing dependencies
```bash
npm run scan:fix
```

### Scan and remove extraneous dependencies
```bash
npm run scan:clean
```

### Scan and fix both missing and extraneous dependencies
```bash
npm run scan:fix-all
```

### Verbose output
```bash
npm run scan:verbose
```

### Development mode
```bash
npm run dev
```

## Command Line Options

- `--fix`: Automatically add missing dependencies to package.json files
- `--remove-extraneous`: Automatically remove unused dependencies from package.json files
- `--verbose`: Show detailed output including file scanning progress

## How it works

1. **Package Discovery**: Finds all packages in the `packages/` directory that start with `node-opcua-`
2. **Source Directory Detection**: Looks for TypeScript files in `source/`, `src/`, or `sources/` directories
3. **Test Directory Detection**: Also scans `test/`, `tests/`, and `test_helpers/` directories
4. **Import Extraction**: Parses TypeScript files to extract all external module imports
5. **Dependency Analysis**: Compares imports against declared dependencies in package.json
6. **Missing Detection**: Identifies missing dependencies including:
   - **Source dependencies**: Dependencies needed for source code (added to `dependencies`)
   - **Test dependencies**: Dependencies needed for test code (added to `devDependencies`)
   - **Local monorepo packages**: node-opcua packages that are imported but not declared
   - **External npm packages**: External dependencies like `chalk`, `lodash`, `async`, etc.
7. **Extraneous Detection**: Identifies unused dependencies that are declared but not imported:
   - **Dependencies**: Must be imported in source files
   - **DevDependencies**: Must be imported in test files
8. **Auto-fix**: When `--fix` is used, adds missing dependencies with appropriate versions
9. **Auto-clean**: When `--remove-extraneous` is used, removes unused dependencies

## Supported Import Patterns

- ES6 imports: `import { something } from 'module-name'`
- CommonJS require: `const module = require('module-name')`
- Dynamic imports: `import('module-name')`

## Package Name Normalization

The tool automatically normalizes package names to handle subpath imports:

- **Regular packages**: `node-opcua-crypto/web` → `node-opcua-crypto`
- **Scoped packages**: `@foo/bar/stuff` → `@foo/bar`
- **Simple packages**: `lodash` → `lodash` (unchanged)

This ensures that imports like `node-opcua-crypto/web` are correctly identified as dependencies on the `node-opcua-crypto` package.

## External Dependencies

The tool checks for external dependencies that should be declared in package.json. This includes:

- **chalk**: Terminal styling library
- **lodash**: Utility library
- **async**: Asynchronous utilities
- **dequeue**: Queue implementation
- **thenify-ex**: Promise utilities
- **@ster5/global-mutex**: Global mutex implementation
- **Any other npm package**: The tool will detect any external package that's imported but not declared

The tool intelligently distinguishes between Node.js built-in modules (which are ignored) and external npm packages (which should be declared as dependencies).

## Special Type Dependencies

The tool automatically includes certain type definitions that are required for TypeScript projects:

- **@types/lodash**: Automatically added when `lodash` is imported (since lodash doesn't have built-in TypeScript definitions)

These type dependencies are added to the same section (dependencies or devDependencies) as their corresponding runtime dependencies.

## Excluded Modules

The tool automatically excludes:
- **Local imports**: Relative imports (starting with `./` or `../`)
- **Built-in modules**: Node.js built-in modules (fs, path, util, etc.)
- **Node.js protocol modules**: Modules using `node:` prefix (node:fs, node:path, etc.)
- **Special modules**: Specific modules like `usage` that are internal
- **Absolute paths**: Imports starting with `/`
- **Internal references**: Local file references within the same package

## Detected Dependencies

The tool detects missing dependencies for:
- **Local monorepo packages**: `node-opcua-*` packages
- **External npm packages**: Simple package names like `chalk`, `lodash`, `async`
- **Scoped packages**: `@scope/package` packages like `@ster5/global-mutex`

### Dependency Categories

- **Source Dependencies**: Dependencies imported in source code (added to `dependencies`)
- **Test Dependencies**: Dependencies imported in test files (added to `devDependencies`)
- **Extraneous Dependencies**: Dependencies declared but not imported anywhere (removed)
  - **Extraneous Dependencies**: Dependencies not imported in source files
  - **Extraneous DevDependencies**: DevDependencies not imported in test files

Examples of ignored imports:
```typescript
import { something } from './utils';           // ✅ Ignored
import { other } from '../helpers';            // ✅ Ignored
const fs = require('fs');                     // ✅ Ignored
import { path } from 'path';                  // ✅ Ignored
import { fs } from 'node:fs';                 // ✅ Ignored (node: protocol)
import { usage } from 'usage';                // ✅ Ignored (special module)
```

Examples of normalized imports:
```typescript
import { crypto } from 'node-opcua-crypto/web';  // → node-opcua-crypto
import { utils } from '@foo/bar/stuff';          // → @foo/bar
import { assert } from 'node-opcua-assert';      // → node-opcua-assert (unchanged)
```

Examples of special type dependencies:
```typescript
import { _ } from 'lodash';                      // → lodash + @types/lodash (auto-added)
```

Examples of dependency categorization:
```typescript
// Source file: source/index.ts
import { chalk } from 'chalk';                   // → dependencies

// Test file: test/index.test.ts
import { mocha } from 'mocha';                   // → devDependencies
import { assert } from 'node-opcua-assert';      // → devDependencies

// If mocha is in devDependencies but only used in source files → extraneous
// If chalk is in dependencies but only used in test files → extraneous
```

## Example Output

```
Scanning node-opcua monorepo for missing dependencies...

❌ node-opcua-basic-types: Missing dependencies:
  - node-opcua-assert
  - node-opcua-binary-stream

❌ node-opcua-basic-types: Missing devDependencies:
  - mocha

⚠️  node-opcua-basic-types: Extraneous dependencies:
  Dependencies (not used in source files):
    - unused-package
  DevDependencies (not used in test files):
    - unused-test-package

🔧 Adding missing dependencies...
  + Adding node-opcua-assert@2.139.0 to dependencies
  + Adding node-opcua-binary-stream@2.153.0 to dependencies
  ✅ Added 2 missing dependencies

🔧 Adding missing devDependencies...
  + Adding mocha@10.0.0 to devDependencies
  ✅ Added 1 missing devDependencies

📊 Summary:
  Total packages scanned: 85
  Total missing dependencies found: 2
  Total missing devDependencies found: 1
  Total extraneous dependencies found: 3
  Total dependencies added: 2
  Total devDependencies added: 1
  Total dependencies removed: 3

💡 Run 'npm install' in the root directory to install the new dependencies.
```

## Development

### Project Structure
```
tools/scan-dependencies/
├── src/
│   └── index.ts          # Main entry point
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Building
```bash
npm run build
```

### Running Tests
```bash
npm test
```

## Contributing

1. Make changes to `src/index.ts`
2. Run `npm run build` to compile
3. Test with `npm run scan`

## License

MIT 
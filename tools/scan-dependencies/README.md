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
- `--verbose`: Show detailed output including file scanning progress

## How it works

1. **Package Discovery**: Finds all packages in the `packages/` directory that start with `node-opcua-`
2. **Source Directory Detection**: Looks for TypeScript files in `source/`, `src/`, or `sources/` directories
3. **Import Extraction**: Parses TypeScript files to extract all external module imports
4. **Dependency Analysis**: Compares imports against declared dependencies in package.json
5. **Missing Detection**: Identifies missing dependencies including:
   - **Local monorepo packages**: node-opcua packages that are imported but not declared
   - **External npm packages**: External dependencies like `chalk`, `lodash`, `async`, etc.
6. **Auto-fix**: When `--fix` is used, adds missing dependencies with appropriate versions

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

## Example Output

```
Scanning node-opcua monorepo for missing dependencies...

❌ node-opcua-basic-types: Missing dependencies:
  - node-opcua-assert
  - node-opcua-binary-stream

🔧 Fixing package.json...
  + Adding node-opcua-assert@2.139.0 to dependencies
  + Adding node-opcua-binary-stream@2.153.0 to dependencies
  ✅ Fixed 2 missing dependencies

📊 Summary:
  Total packages scanned: 85
  Total missing dependencies found: 2
  Total dependencies fixed: 2

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
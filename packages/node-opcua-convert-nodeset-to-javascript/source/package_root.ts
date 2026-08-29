import path from "node:path";

/**
 * The one place this package learns where it sits on disk.
 *
 * Everything else derives from `packagesFolder` rather than recomputing it, so the
 * ESM migration has a single line to change here instead of five scattered across
 * four files. `import.meta.dirname` cannot be used while this package emits CommonJS
 * (TS1470), which is why the flip has to wait for the package to become "type": "module".
 *
 * Deliberately not `process.cwd()`: this package declares a `bin`, so it can be invoked
 * as a CLI from any directory, and cwd would then resolve somewhere else entirely.
 * A tool has to find its own files relative to itself.
 */
const here = __dirname;

/** this package's own root, one level above the compiled output */
export const packageRoot = path.join(here, "..");

/** the monorepo's packages/ folder, which is where generated nodeset packages are written */
export const packagesFolder = path.join(here, "../../");

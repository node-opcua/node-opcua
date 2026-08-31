/**
 * Where this package's tests write their scratch files.
 *
 * Fixtures come from getAddressSpaceFixture() in test_helpers; this covers the output side.
 * Anchored on the package's package.json rather than a count of `../` segments, because the
 * same file resolves differently from `test/` than from `dist/test/`.
 *
 * At the ESM flip, `__dirname` becomes `import.meta.dirname` here and nowhere else in these
 * tests.
 */
import path from "node:path";
import { findUp } from "node-opcua-test-helpers";

/** this package's directory */
export const packageRoot = findUp(__dirname, "package.json");

/**
 * Somewhere under the package root that a test writes into. A plain path: these suites
 * create and remove the directory themselves.
 */
export function scratch(...segments: string[]): string {
    return path.join(packageRoot, ...segments);
}

/**
 * Where this package's tests read their inputs from and write their scratch files to.
 *
 * The one module in these tests that knows its own location, anchored on the package's
 * package.json rather than on a count of `../` segments: the same file resolves
 * differently when it runs from `test/` than from `dist/test/`, so the count was never a
 * constant.
 *
 * At the ESM flip, `__dirname` becomes `import.meta.dirname` here and nowhere else in
 * this package's tests.
 */
import path from "node:path";
import { findUp } from "node-opcua-test-helpers";

/** this package's directory */
export const packageRoot = findUp(__dirname, "package.json");

/** somewhere under test/, where a suite's inputs live */
export function testPath(...segments: string[]): string {
    return path.join(packageRoot, "test", ...segments);
}

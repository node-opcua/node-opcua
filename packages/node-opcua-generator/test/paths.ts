/**
 * Where this package's tests read their fixtures from and write their generated code to.
 *
 * The one module in these tests that knows its own location, anchored on the package's
 * package.json rather than on a count of `../` segments: the same file resolves differently
 * when it runs from `test/` than from `dist/test/`, so the count was never a constant.
 *
 * At the ESM flip, `__dirname` becomes `import.meta.dirname` here and nowhere else in this
 * package's tests.
 */
import path from "node:path";
import { findUp } from "node-opcua-test-helpers";

/** this package's directory */
export const packageRoot = findUp(__dirname, "package.json");

/** a binary schema the generator reads: testFixture("SampleTypes.bsd") */
export function testFixture(...segments: string[]): string {
    return path.join(packageRoot, "test", "fixtures", ...segments);
}

/**
 * Where a test writes the code it generates. Gitignored, and each suite creates and removes
 * its own subfolder, so two suites cannot collide over one directory.
 */
export function generatedFolder(...segments: string[]): string {
    return path.join(packageRoot, "test", "_generated_", ...segments);
}

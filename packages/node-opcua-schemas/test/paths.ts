/**
 * Where this package's tests read their fixtures from.
 *
 * The one module in these tests that knows its own location, anchored on the package's
 * package.json rather than on a count of `../` segments: the same file resolves differently
 * when it runs from `test/` than from `dist/test/`, so the count was never a constant.
 *
 * At the ESM flip, `__dirname` becomes `import.meta.dirname` here and nowhere else.
 */
import path from "node:path";
import { findUp } from "node-opcua-test-helpers";

const packageRoot = findUp(__dirname, "package.json");

/** a schema fixture: testFixture("sample_type.xsd") */
export function testFixture(...segments: string[]): string {
    return path.join(packageRoot, "test", "fixtures", ...segments);
}

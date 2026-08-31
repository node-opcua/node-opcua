/**
 * Where the tests read fixtures from and write generated files to.
 *
 * This is the one module in this package's tests that knows its own location. Everything
 * else asks for a named place instead of counting `../` segments.
 *
 * That counting is what made these paths fragile: the same file resolves differently when
 * it runs from `test/` than from `dist/test/`, so the depth was not actually a constant.
 * One caller had grown a runtime fallback to cope -
 *
 *     let certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
 *     if (!fs.existsSync(certificateFolder)) {
 *         certificateFolder = path.join(__dirname, "../../../../node-opcua-samples/certificates");
 *     }
 *
 * - which is a depth guess with a second guess behind it. Anchoring on a marker file
 * instead of on a segment count removes the question.
 *
 * At the ESM flip, `__dirname` below becomes `import.meta.dirname` and nothing else in the
 * package changes.
 */
import fs from "node:fs";
import path from "node:path";
import { findUp, modelingFile, samplesCertificateFolder } from "node-opcua-test-helpers";

/**
 * This package's root, whether the caller was compiled or is running from source: both
 * `test_helpers/` and `dist/test_helpers/` sit inside it.
 *
 * `findUp` and the repo-level locations come from node-opcua-test-helpers, which is
 * `"private": true` and knows the workspace layout once for every package.
 */
export const packageRoot = findUp(__dirname, "package.json");

export { modelingFile };

// The three that call sites already had a local name for are exported as plain paths, so
// adopting them is a deletion at the call site rather than a rename.

/** where a test writes files it generates */
export const tmpFolder = path.join(packageRoot, "tmp");

/** the certificate store shipped with node-opcua-samples */
export const certificateFolder = samplesCertificateFolder;

/** input fixtures committed next to the tests */
export const fixturesFolder = path.join(packageRoot, "fixtures");

/** an input fixture: `testFixture("a.xml")` */
export function testFixture(...segments: string[]): string {
    return path.join(fixturesFolder, ...segments);
}

/**
 * A named sub-directory of {@link tmpFolder}, created on demand: a test that writes into a
 * folder of its own should not also have to remember to make it.
 */
export function tmpFolderFor(...segments: string[]): string {
    const folder = path.join(tmpFolder, ...segments);
    fs.mkdirSync(folder, { recursive: true });
    return folder;
}

/** a server script under test_helpers/bin, spawned as a subprocess */
export function serverScript(name: string): string {
    return path.join(packageRoot, "test_helpers", "bin", name);
}

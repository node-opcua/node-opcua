import { modelingFile } from "node-opcua-test-helpers";
/**
 * This package's root, whether the caller was compiled or is running from source: both
 * `test_helpers/` and `dist/test_helpers/` sit inside it.
 *
 * `findUp` and the repo-level locations come from node-opcua-test-helpers, which is
 * `"private": true` and knows the workspace layout once for every package.
 */
export declare const packageRoot: string;
export { modelingFile };
/**
 * Somewhere under the package root that a test writes into. A plain path: these suites
 * create and remove the directory themselves.
 */
export declare function scratch(...segments: string[]): string;
/** where a test writes files it generates */
export declare const tmpFolder: string;
/** the certificate store shipped with node-opcua-samples */
export declare const certificateFolder: string;
/** input fixtures committed next to the tests */
export declare const fixturesFolder: string;
/** an input fixture: `testFixture("a.xml")` */
export declare function testFixture(...segments: string[]): string;
/**
 * A named sub-directory of {@link tmpFolder}, created on demand: a test that writes into a
 * folder of its own should not also have to remember to make it.
 */
export declare function tmpFolderFor(...segments: string[]): string;
/** a server script under test_helpers/bin, spawned as a subprocess */
export declare function serverScript(name: string): string;
/**
 * A helper spawned from its compiled form under dist/, rather than from source the way
 * serverScript's targets are. Kept separate so the two are not confused: this one only
 * exists after a build.
 */
export declare function compiledHelper(name: string): string;
//# sourceMappingURL=paths.d.ts.map
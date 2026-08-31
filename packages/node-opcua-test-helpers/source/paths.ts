/**
 * Locations that belong to the repository rather than to any one package.
 *
 * Several suites read the certificates shipped with node-opcua-samples, the hand-written
 * models at the repo root, or a specific nodeset version. Each had spelled the way there
 * out as a count of `../` segments, which is not a constant: the same file resolves
 * differently when it runs from `test/` than from `dist/test/`. One caller had grown a
 * runtime fallback to cope with exactly that.
 *
 * Anchoring on a marker file removes the question. This module and one small `paths.ts` per
 * package are then the only places that know their own location, so the ESM flip is a
 * one-line change in each rather than a hunt through the suites.
 *
 * This package is `"private": true` and never published, which is what makes it a
 * reasonable place to put knowledge of the monorepo layout.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * The nearest directory at or above `from` that contains `marker`.
 *
 * Exported because each package needs its own root and cannot get it from this module:
 * `findUp(__dirname, "package.json")` in a package's own `paths.ts` is the intended use.
 */
export function findUp(from: string, marker: string): string {
    let dir = from;
    for (;;) {
        if (fs.existsSync(path.join(dir, marker))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error(`cannot find ${marker} at or above ${from}`);
        }
        dir = parent;
    }
}

/** the workspace root, found from this file rather than from the working directory */
export const monorepoRoot = findUp(__dirname, "pnpm-workspace.yaml");

/** a package directory in the workspace: packagePath("node-opcua-samples") */
export function packagePath(packageName: string, ...segments: string[]): string {
    return path.join(monorepoRoot, "packages", packageName, ...segments);
}

/** the certificate store shipped with node-opcua-samples, used by the security suites */
export const samplesCertificateFolder = packagePath("node-opcua-samples", "certificates");

/** the hand-written models at the repo root, which several suites load as nodesets */
export function modelingFile(...segments: string[]): string {
    return path.join(monorepoRoot, "modeling", ...segments);
}

/** a nodeset shipped by node-opcua-nodesets, including the older revisions kept for tests */
export function nodesetFile(...segments: string[]): string {
    return packagePath("node-opcua-nodesets", "nodesets", ...segments);
}

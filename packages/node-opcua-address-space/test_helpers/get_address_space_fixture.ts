/**
 * @module node-opcua-address-space
 */
import fs from "node:fs";
import path from "node:path";

/**
 * The one place this package's tests resolve a fixture.
 *
 * It used to try three candidate folders in turn, because `__dirname` lands somewhere
 * different depending on whether the caller was compiled - a depth guess with two more
 * behind it. Anchoring on the package root removes the question, and at the ESM flip
 * `__dirname` becomes `import.meta.dirname` here and nowhere else.
 */
const packageRoot = findPackageRoot(__dirname);

/**
 * The nearest ancestor holding a package.json. Kept local on purpose: this file
 * ships in distHelpers, and node-opcua-test-helpers is private to the monorepo,
 * so a consumer installing the package must not need it.
 */
function findPackageRoot(from: string): string {
    let dir = from;
    for (;;) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error(`cannot find package.json at or above ${from}`);
        }
        dir = parent;
    }
}

/** nodesets shipped by this package */
const nodesetsFolder = path.join(packageRoot, "nodesets");

/** XML fixtures the tests load */
const fixturesFolder = path.join(packageRoot, "test_helpers", "test_fixtures");

export function getAddressSpaceFixture(pathname: string): string {
    // a nodeset shipped by the package wins over a test fixture of the same name
    const asNodeset = path.join(nodesetsFolder, pathname);
    if (fs.existsSync(asNodeset)) {
        return asNodeset;
    }
    const asFixture = path.join(fixturesFolder, pathname);
    // c8 ignore next
    if (!fs.existsSync(asFixture)) {
        throw new Error(`cannot find fixture with name ${pathname}: looked in ${nodesetsFolder} and ${fixturesFolder}`);
    }
    return asFixture;
}

/**
 * @module node-opcua-address-space
 *
 * @deprecated Import the package, or `node-opcua-address-space/dist/source/index.js`.
 *
 * This was the package's `main` until the entry points were unified. It named nothing - there
 * has never been an `index_previous` - and it published a different set of names from the
 * `types` entry beside it: twelve that the .d.ts promised were missing here, and fifty-two
 * that only existed here and so could not be imported from TypeScript at all.
 *
 * It is kept for one release, for anyone who reached past `main` and named this file, and is
 * removed at 3.0.
 */
export * from "../source/index.js";

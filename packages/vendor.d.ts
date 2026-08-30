/**
 * Ambient declarations for dependencies that ship no types of their own.
 *
 * These modules were reached with `require()`, which yields `any` and needs no
 * declaration at all. `require()` does not exist in an ES module, so the call sites moved
 * to `import` and the missing types had to be declared somewhere.
 *
 * Shared rather than per-package, and pulled in by `files` in tsconfig.common.json, which
 * every package and every test config extends. Per-package declarations do not work here:
 * an ambient declaration is only visible to compilations that *include* the file, and a
 * package's tsconfig cannot include another package's. node-opcua-end2end-test
 * type-checks across into node-opcua-address-space/src, so a declaration living in
 * address-space was invisible to it.
 *
 * Shorthand deliberately: these resolve to `any`, which is exactly what `require()` gave,
 * so nothing about type checking changes. Writing real declarations for these libraries
 * would be an improvement, but it is separate work with its own risk of being subtly
 * wrong, and mixing it into a module-format change would hide one inside the other.
 */
declare module "xml-writer";
declare module "dequeue";
declare module "humanize";
declare module "backoff";
declare module "enum";

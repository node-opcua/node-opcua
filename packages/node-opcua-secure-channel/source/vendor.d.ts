/**
 * Ambient declaration for a dependency that ships no types.
 *
 * Reached with `require()` before, which yields `any` and needs no declaration.
 * `require()` is not available in an ES module, so the call site moved to `import` and
 * the missing type had to be declared. Shorthand deliberately: it resolves to `any`,
 * exactly what `require()` gave, so type checking is unchanged.
 */
declare module "backoff";

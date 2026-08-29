/**
 * Ambient declarations for dependencies that ship no types.
 *
 * These modules were reached with `require()`, which yields `any` and needs no
 * declaration. `require()` is not available in an ES module, so the call sites moved to
 * `import` and the missing types had to be declared somewhere.
 *
 * Shorthand declarations deliberately: they resolve to `any`, which is exactly what
 * `require()` gave, so nothing about type checking changes here. Writing real
 * declarations for these libraries would be an improvement, but it is a separate piece
 * of work with its own risk of being subtly wrong, and mixing it into a module-format
 * change would hide one inside the other.
 */
declare module "xml-writer";
declare module "dequeue";

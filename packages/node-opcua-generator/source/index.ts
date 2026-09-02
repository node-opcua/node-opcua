/* c8 ignore start */
/**
 * @module node-opcua-generator
 */

export { generate } from "./generate_extension_object_code.js";

/**
 * The schema-literal path, deprecated and going at 3.0.
 *
 * These three and `generateCode` behind them cannot work: `registerObject` builds
 * `<name>_Schema` and `generateCode` then looks up `<name>_Schema_Schema`, and `generateCode`
 * hands `produce_TScript_code` a raw schema literal where it wants a built
 * `StructuredTypeSchema`. Both throw. They date from the 2018 TypeScript port and were only
 * ever covered by the test files that port disabled.
 *
 * Nothing in this repository calls them - `node-opcua-types` uses `generate` - and they are
 * not re-exported by the `node-opcua` umbrella, so reaching them means depending on this
 * build-time package directly and calling something that throws.
 *
 * @deprecated cannot work; use `generate`, which is what builds node-opcua-types
 */
export { generateTypeScriptCodeFromSchema, registerObject, unregisterObject } from "./generator.js";
/* c8 ignore stop */

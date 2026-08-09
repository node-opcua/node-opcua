/**
 * @module node-opcua-utils/browser
 *
 * Browser-safe subset of `node-opcua-utils`. Selected automatically by
 * bundlers (esbuild, webpack, vite, rollup) via the `"browser"` condition
 * in this package's `exports` map.
 *
 * Excludes `check_file_exists`, which does `import fs from "fs"` at
 * module load. Nothing else in the barrel is Node-only.
 *
 * ## Bundler configuration required
 *
 * `watchdog.ts` (still exported here) imports `node:events`. Browser
 * bundlers do not auto-polyfill `node:`-prefixed built-ins; consumers
 * must alias it to a polyfill package such as `events`. Example
 * (esbuild):
 *
 *   alias: { "node:events": "events" }
 *
 * (We deliberately do not declare `events` as a dependency of this
 * package — Node consumers would pay the install cost for no benefit,
 * and Node would prefer the npm port over its own built-in.)
 */

export function isNullOrUndefined(value: unknown | undefined): boolean {
    return value === undefined || value === null;
}
export { buffer_ellipsis } from "./buffer_ellipsis";
export { compare_buffers } from "./compare_buffers";
export * from "./flags";
export { get_clock_tick } from "./get_clock_tick";
export { getFunctionParameterNames } from "./get_function_parameters_name";
export { hrtime } from "./hrtime";
export * from "./line_file";
export * from "./match_uri";
export { randomBytes } from "./nodejs/random_bytes.browser";
export { getObjectClassName } from "./object_classname";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump";
export { setDeprecated } from "./set_deprecated";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils";
export * from "./timestamp";
export * from "./watchdog";
// `checkFileExistsAndIsNotEmpty` is intentionally omitted from the browser entry —
// it `require("fs")` at module load and has no browser-meaningful behaviour.

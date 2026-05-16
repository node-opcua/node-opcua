/**
 * @module node-opcua-utils/browser
 *
 * Browser-safe subset of `node-opcua-utils`. Selected automatically by
 * bundlers (esbuild, webpack, vite, rollup) via the `"browser"` condition
 * in this package's `exports` map.
 *
 * Excludes `check_file_exists`, which does `import fs from "fs"` at
 * module load. Nothing else in the barrel is Node-only.
 */
// tslint:disable:no-bitwise
import { assert } from "node-opcua-assert";

export function set_flag(value: number, mask: number | { value: number }): number {
    // biome-ignore lint/suspicious/noExplicitAny: legacy flag-shape compatibility
    if ((mask as any).value) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy flag-shape compatibility
        mask = (mask as any).value;
    }
    assert(!Object.prototype.hasOwnProperty.call(mask, "value"));
    assert(mask !== undefined);
    return value | (mask as number);
}

export function check_flag(value: number, mask: number | { value: number }): boolean {
    // biome-ignore lint/suspicious/noExplicitAny: legacy flag-shape compatibility
    if ((mask as any).value) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy flag-shape compatibility
        mask = (mask as any).value;
    }
    assert(!Object.prototype.hasOwnProperty.call(mask, "value"));
    return (value & (mask as number)) === (mask as number);
}

export function isNullOrUndefined(value: unknown | undefined): boolean {
    return value === undefined || value === null;
}

export { buffer_ellipsis } from "./buffer_ellipsis";
export { compare_buffers } from "./compare_buffers";
export { get_clock_tick } from "./get_clock_tick";
export { getFunctionParameterNames } from "./get_function_parameters_name";
export { hrtime } from "./hrtime";
export * from "./line_file";
export * from "./match_uri";
export { getObjectClassName } from "./object_classname";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump";
export { setDeprecated } from "./set_deprecated";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils";
export * from "./timestamp";
export * from "./watchdog";
// `checkFileExistsAndIsNotEmpty` is intentionally omitted from the browser entry —
// it `require("fs")` at module load and has no browser-meaningful behaviour.

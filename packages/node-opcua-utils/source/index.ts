/**
 * @module node-opcua-utils
 */

export function isNullOrUndefined(value: unknown | undefined): boolean {
    return value === undefined || value === null;
}

export { buffer_ellipsis } from "./buffer_ellipsis.js";
export { compare_buffers } from "./compare_buffers.js";
export * from "./flags.js";
export { get_clock_tick } from "./get_clock_tick.js";
export { getFunctionParameterNames } from "./get_function_parameters_name.js";
export { hrtime } from "./hrtime.js";
export * from "./line_file.js";
export * from "./match_uri.js";
export { checkFileExistsAndIsNotEmpty } from "./nodejs/check_file_exists.js";
export { getObjectClassName } from "./object_classname.js";
export { randomBytes } from "./random_bytes.js";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump.js";
export { setDeprecated } from "./set_deprecated.js";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils.js";
export * from "./timestamp.js";
export * from "./watchdog.js";

/**
 * @module node-opcua-utils
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
export { checkFileExistsAndIsNotEmpty } from "./nodejs/check_file_exists";
export { getObjectClassName } from "./object_classname";
export { randomBytes } from "./random_bytes";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump";
export { setDeprecated } from "./set_deprecated";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils";
export * from "./timestamp";
export * from "./watchdog";

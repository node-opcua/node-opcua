/**
 * @module opcua.utils
 */

const assert = require("node-opcua-assert").assert;
const path = require("path");

/**
 * set a flag
 * @method set_flag
 * @param value
 * @param mask<
 * @return {number}
 */
export function set_flag(value: number, mask: { value: number }): number {
    assert(mask !== undefined);
    return value | mask.value;
}
/**
 * check if a set of bits are set in the values
 * @method check_flag
 *
 * @param value
 * @param mask
 * @return {boolean}
 */
export function check_flag(value: number, mask: { value: number }): boolean {
    assert(mask !== undefined && mask.value);
    return (value & mask.value) === mask.value;
}

// ---------------------------------------------------------------------------------------------------------------------
/**
 * @method normalize_require_file
 * @param baseFolder
 * @param full_path_to_file
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
export function normalize_require_file(baseFolder: string, full_path_to_file: string): string {
    let local_file = path.relative(baseFolder, full_path_to_file).replace(/\\/g, "/");
    // append ./ if necessary
    if (local_file.substr(0, 1) !== ".") {
        local_file = "./" + local_file;
    }
    // remove extension
    local_file = local_file.substr(0, local_file.length - path.extname(local_file).length);
    return local_file;
}

export function isNullOrUndefined(value: any): boolean {
    return value === undefined || value === null;
}

export { buffer_ellipsis } from "./buffer_ellipsis";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils";
export { getObjectClassName } from "./object_classname";
export { get_clock_tick } from "./get_clock_tick";
export { compare_buffers } from "./compare_buffers";
export { constructFilename } from "./construct_filename";
export { getFunctionParameterNames } from "./get_function_parameters_name";
export { WatchDog } from "./watchdog";
export { LineFile } from "./linefile";

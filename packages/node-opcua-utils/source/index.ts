/**
 * @module node-opcua-utils
 */
// tslint:disable:no-bitwise
import { assert } from "node-opcua-assert";
import * as path from "path";

/**
 * set a flag
 * @method set_flag
 */
export function set_flag(value: number, mask: number | { value: number }): number {
    if ((mask as any).value) {
        mask = (mask as any).value;
    }
    assert(!mask.hasOwnProperty("value"));
    assert(mask !== undefined);
    return value | (mask as number);
}
/**
 * check if a set of bits are set in the values
 * @method check_flag
 */
export function check_flag(value: number, mask: number | { value: number }): boolean {
    if ((mask as any).value) {
        mask = (mask as any).value;
    }
    assert(!mask.hasOwnProperty("value"));
    return ((value & (mask as number)) === (mask as number));
}

// ---------------------------------------------------------------------------------------------------------------------
/**
 * @method normalize_require_file
 * @param baseFolder
 * @param fullPathToFile
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
export function normalize_require_file(baseFolder: string, fullPathToFile: string): string {
    let localFile = path.relative(baseFolder, fullPathToFile).replace(/\\/g, "/");
    // append ./ if necessary
    if (localFile.substr(0, 1) !== ".") {
        localFile = "./" + localFile;
    }
    // remove extension
    localFile = localFile.substr(0, localFile.length - path.extname(localFile).length);
    return localFile;
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
export * from "./watchdog";
export { LineFile } from "./linefile";
export { setDeprecated } from "./set_deprecated";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump";
export * from "./timestamp";

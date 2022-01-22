/**
 * @module node-opcua-utils
 */
// tslint:disable:no-bitwise
import { assert } from "node-opcua-assert";

/**
 * set a flag
 * @method set_flag
 */
export function set_flag(value: number, mask: number | { value: number }): number {
    if ((mask as any).value) {
        mask = (mask as any).value;
    }
    assert(!Object.prototype.hasOwnProperty.call(mask, "value"));
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
    assert(!Object.prototype.hasOwnProperty.call(mask, "value"));
    return (value & (mask as number)) === (mask as number);
}

export function isNullOrUndefined(value: unknown | undefined): boolean {
    return value === undefined || value === null;
}

export { buffer_ellipsis } from "./buffer_ellipsis";
export { capitalizeFirstLetter, lowerFirstLetter } from "./string_utils";
export { getObjectClassName } from "./object_classname";
export { get_clock_tick } from "./get_clock_tick";
export { compare_buffers } from "./compare_buffers";
export { getFunctionParameterNames } from "./get_function_parameters_name";
export * from "./watchdog";
export { setDeprecated } from "./set_deprecated";
export { replaceBufferWithHexDump } from "./replace_buffer_with_hex_dump";
export * from "./timestamp";
export * from "./line_file";
export * from "./match_uri";
export {hrtime} from "./hrtime";
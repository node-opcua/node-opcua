// tslint:disable:no-bitwise
import { assert } from "node-opcua-assert";

/**
 * set a flag

 */
export function set_flag(value: number, mask: number | { value: number }): number {
    if ((mask as { value: number }).value) {
        mask = (mask as { value: number }).value;
    }
    assert(!(typeof mask === "object" && Object.hasOwn(mask, "value")));
    assert(mask !== undefined);
    return value | (mask as number);
}
/**
 * check if a set of bits are set in the values

 */
export function check_flag(value: number, mask: number | { value: number }): boolean {
    if ((mask as { value: number }).value) {
        mask = (mask as { value: number }).value;
    }
    assert(!(typeof mask === "object" && Object.hasOwn(mask, "value")));
    assert(mask !== undefined);
    return (value & (mask as number)) === (mask as number);
}

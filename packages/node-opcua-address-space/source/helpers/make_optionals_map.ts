/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";

/**
 * transform  optional into a map
 *
 * @example
 * ```javascript
 * const optionals = [ "A", "B", "C.D" ];
 *
 * const map = makeOptionalsMap(optionals);
 * const map = {
 *   A: {}
 *   B: {}
 *   C: {  D: {} }
 * };
 * ```
 *
 * @internal
 */
export interface OptionalMap {
    [key: string]: OptionalMap;
}
export function makeOptionalsMap(optionals?: string[] | null): OptionalMap {
    const resultMap: OptionalMap = {};
    if (!optionals) {
        return resultMap;
    }
    assert(optionals instanceof Array);

    function insertInMap(map: OptionalMap, s: string[]): void {
        const key = s[0];

        if (!map[key]) {
            map[key] = {};
        }
        if (s.length > 1) {
            insertInMap(map[key], s.splice(1));
        }
    }

    for (const opt of optionals) {
        const s: string[] = opt.split(".");
        insertInMap(resultMap, s);
    }
    return resultMap;
}

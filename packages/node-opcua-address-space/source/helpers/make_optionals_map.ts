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
export type OptionalMap = Record<string, string| Record<string,any>>;

export function makeOptionalsMap(optionals?: string[] | null): OptionalMap {
    // make sure to use Object.create(null); to create a object with no prototype
    // so that we prevent prototype pollution
    const resultMap: OptionalMap = Object.create(null);
    if (!optionals) {
        return resultMap;
    }
    assert(optionals instanceof Array);

    function insertInMap(map: Record<string,any>, s: string[]): void {
        const key = s[0];

        if (!map[key]) {
            // make sure to use Object.create(null); to create a object with no prototype
            // so that we prevent prototype pollution
            map[key] =  Object.create(null);
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

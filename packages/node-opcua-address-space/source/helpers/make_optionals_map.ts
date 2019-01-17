import { assert } from "node-opcua-assert";

/**
 * @method makeOptionalsMap
 * @param optionals
 * transform  optional into a map
 * @internal
 */

export function makeOptionalsMap(
  optionals?: string[] | null
): { [key: string]: any }  {

    const resultMap = {};
    if (!optionals) {
        return resultMap;
    }
    assert(optionals instanceof Array);

    function insertInMap(map: any, s: any): any {
        const key = s[0];

        if (!map[key]) {
            map[key] = {};
        }
        if (s.length > 1) {
            insertInMap(map[key], s.splice(1));
        }
    }

    for (const opt of optionals) {
        const s = opt.split(".");
        insertInMap(resultMap, s);

    }
    return resultMap;
}

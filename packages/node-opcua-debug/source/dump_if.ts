/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
import { inspect } from "util";

export function dump(obj: any) {
    console.log("\n", inspect(JSON.parse(JSON.stringify(obj)), { colors: true, depth: 10 }));
}
export function dumpIf(condition: boolean, obj: any) {
    if (condition) {
        dump(obj);
    }
}

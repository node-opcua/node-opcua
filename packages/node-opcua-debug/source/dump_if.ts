/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
import { inspect } from "util";

export function dump(obj: unknown): void {
    console.log("\n", inspect(JSON.parse(JSON.stringify(obj)), { colors: true, depth: 10 }));
}
export function dumpIf(condition: boolean, obj: unknown): void {
    if (condition) {
        dump(obj);
    }
}

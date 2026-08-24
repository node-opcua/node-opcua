/**
 * @module node-opcua-debug
 */
import { inspect } from "node:util";

export function dump(obj: unknown): void {
    console.log("\n", inspect(JSON.parse(JSON.stringify(obj)), { colors: true, depth: 10 }));
}
export function dumpIf(condition: boolean, obj: unknown): void {
    if (condition) {
        dump(obj);
    }
}

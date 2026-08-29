/**
 * @module node-opcua-utils
 */
import { assert } from "node-opcua-assert";

import type { FunctionVariadic } from "./function_variadic.js";

/* c8 ignore next */
export function setDeprecated(constructorFunc: FunctionVariadic, methodName: string, helpString: string): void {
    const oldMethod = constructorFunc.prototype[methodName];

    assert(oldMethod instanceof Function, `expecting a valid ${methodName}method on class ${constructorFunc.constructor.name}`);

    let counter = 0;
    constructorFunc.prototype[methodName] = function (...args: unknown[]) {
        if (counter % 1000 === 0) {
            console.log("Warning !", `${constructorFunc.name}#${methodName}`, " is now deprecated");
            console.log("         ", helpString);
        }
        counter++;
        return oldMethod.call(this, ...args);
    };
}

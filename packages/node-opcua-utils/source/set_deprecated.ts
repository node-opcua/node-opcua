/**
 * @module node-opcua-utils
 */
// tslint:disable:ban-types
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";

import { FunctionVariadic } from "./function_variadic";

/* istanbul ignore next */
export function setDeprecated(constructor: FunctionVariadic, methodName: string, helpString: string): void {
    const oldMethod = constructor.prototype[methodName];

    assert(oldMethod instanceof Function, "expecting a valid " + methodName + "method on class " + constructor.constructor.name);

    let counter = 0;
    constructor.prototype[methodName] = function (...args: any[]) {
        if (counter % 1000 === 0) {
            // tslint:disable:no-console
            console.log(
                chalk.green("Warning !"),
                chalk.green(chalk.bold(constructor.name + "#" + methodName), " is now deprecated")
            );
            console.log("         ", helpString);
        }
        counter++;
        return oldMethod.call(this, ...args);
    };
}

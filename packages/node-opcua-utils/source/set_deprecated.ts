// tslint:disable:ban-types
import { assert } from "node-opcua-assert";
import chalk from "chalk";

export function setDeprecated(constructor: Function, methodName: string, helpString: string): void {
    const oldMethod = constructor.prototype[methodName];
    assert(oldMethod instanceof Function, "expecting a valid " + methodName + "method on class " + constructor.constructor.name);


    let counter = 0;
    constructor.prototype[methodName] = function () {
        if (counter % 1000 === 0) {
            console.log(chalk.green("Warning !"), "", chalk.green(chalk.bold(constructor.name + "#" + methodName), " is now deprecated"));
            console.log("         ", helpString);
        }
        counter++;
        return oldMethod.apply(this, arguments);
    };

}

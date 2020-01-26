/***
 * @module node-opcua-assert
 */
import * as chalk from "chalk";
import * as PrettyError from "pretty-error";
const pe = new PrettyError();

const displayAssert = process.env.DISPLAY_ASSERT ? true : false;

type func = (...args: any[]) => any;

export function assert(cond: boolean | object | null | undefined | func, message?: string): void {
    if (!cond) {
        const err = new Error(message);
        // istanbul ignore next
        if (displayAssert) {
            // tslint:disable:no-console
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
            console.log(chalk.whiteBright.bgRed(message!));
            console.log(pe.render(err));
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
        }
        throw err;
    }
}
export default assert;

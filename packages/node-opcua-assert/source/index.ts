/***
 * @module node-opcua-assert
 */
import chalk from "chalk";

const displayAssert = process.env.DISPLAY_ASSERT ? true : false;

export function assert(cond: boolean | object | null | undefined | Function, message?: string): void {
    if (!cond) {
        const err = new Error(message);
        if (displayAssert) {
            // tslint:disable:no-console
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
            console.log(chalk.whiteBright.bgRed(message!));
            console.log(err);
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
        }
        throw err;
    }
}
export default assert;

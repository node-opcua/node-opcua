/***
 * @module node-opcua-assert
 */
import * as chalk from "chalk";

const displayAssert = typeof process === "object" ? (process.env.DISPLAY_ASSERT ? true : false) : false;

type func = (...args: any[]) => any;

export function assert(cond: boolean | unknown | null | undefined | func, message?: string): void {
    if (!cond) {
        const err = new Error(message);
        // istanbul ignore next
        if (displayAssert) {
            // tslint:disable:no-console
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
            console.log(chalk.whiteBright.bgRed(message!));
            console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
        }
        throw err;
    }
}
export default assert;

export function renderError(err: unknown): Error {
    return err as Error;
}

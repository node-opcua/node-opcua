import chalk from "chalk";

export function assert(cond: boolean | object | null | undefined | Function, message?: string): void {
    if (!cond) {
        const err = new Error(message);
        console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
        console.log(err);
        console.log(chalk.whiteBright.bgRed("-----------------------------------------------------------"));
        throw err;
    }
}
export default assert;
exports.assert = assert;

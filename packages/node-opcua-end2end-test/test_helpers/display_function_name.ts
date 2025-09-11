import chalk from "chalk";
import { ErrorCallback } from "node-opcua-client";
const { red, green, bgWhite } = chalk;

let step_count = 0;

export function fCallback(doDebug: boolean, func: (callback: ErrorCallback) => void) {

    return function (callback: ErrorCallback) {
        if (doDebug) {
            console.log(bgWhite.cyan("FUNC=>  "), " ", step_count, chalk.yellow.bold(func.name));
        }
        try {

            func(function (err) {
                if (doDebug) {
                    console.log(bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? red(err.name) : green("OK"));
                }
                step_count++;
                setImmediate(() => callback(err));
            });
        } catch (err) {
            if (doDebug) {
                console.log(chalk.bgWhite.cyan("END WITH EXCEPTION=>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? red((err as Error).name) : green("OK"));
            }
            callback(err as Error);
        }
    };
}

export function fAsync<T>(doDebug: boolean, func: () => Promise<T>): () => Promise<T> {

    return async function (): Promise<T> {
        if (doDebug) {
            console.log(bgWhite.cyan("FUNC=>  "), " ", step_count, chalk.yellow.bold(func.name));
        }
        try {
            const res = await func();

            if (doDebug) {
                console.log(bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", green("OK"));
            }
            step_count++;
            return res;
        } catch (err) {
            if (doDebug) {
                console.log(bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", red((err as Error).name));
            }
            throw err;
        }
    };
}

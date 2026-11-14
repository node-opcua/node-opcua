import chalk from "chalk";
const { red, green, bgWhite } = chalk;
let step_count = 0;
export function fCallback(doDebug, func) {
    return (callback) => {
        if (doDebug) {
            console.log(bgWhite.cyan("FUNC=>  "), " ", step_count, chalk.yellow.bold(func.name));
        }
        try {
            func((err) => {
                if (doDebug) {
                    console.log(bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? red(err.name) : green("OK"));
                }
                step_count++;
                setImmediate(() => callback(err));
            });
        }
        catch (err) {
            if (doDebug) {
                console.log(chalk.bgWhite.cyan("END WITH EXCEPTION=>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? red(err.name) : green("OK"));
            }
            callback(err);
        }
    };
}
export function fAsync(doDebug, func) {
    return async () => {
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
        }
        catch (err) {
            if (doDebug) {
                console.log(bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", red(err.name));
            }
            throw err;
        }
    };
}
//# sourceMappingURL=display_function_name.js.map
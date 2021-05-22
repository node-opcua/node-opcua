const chalk = require("chalk");

let step_count = 0;

function f(doDebug, func) {

    return function (callback) {
        if (doDebug) {
            console.log(chalk.bgWhite.cyan("FUNC=>  "), " ", step_count, chalk.yellow.bold(func.name));
        }
        try {

            func(function (err) {
                if (doDebug) {
                    console.log(chalk.bgWhite.cyan("END =>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? err.name.red : chalk.green("OK"));
                }
                step_count++;
                setImmediate(() => callback(err));
            });
        } catch (err) {
            if (doDebug) {
                console.log(chalk.bgWhite.cyan("END WITH EXCEPTION=>  "), " ", step_count, chalk.yellow.bold(func.name), " => ", err ? err.name.red : chalk.green("OK"));
            }
            callback(err);
        }
    };
}

exports.f = f;

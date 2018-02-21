var colors = require("colors");

var step_count = 0;

function f(doDebug,func) {

    return function (callback) {
        if (doDebug) {
            console.log("FUNC=>  ".bgWhite.cyan, " ", step_count, func.name.yellow.bold);
        }
        try {

            func(function (err) {
                if (doDebug) {
                    console.log("END =>  ".bgWhite.cyan, " ", step_count, func.name.yellow.bold, " => ", err ? err.name.red : "OK".green);
                }
                step_count++;
                setImmediate(function () {
                    callback(err);
                });
            });
        } catch(err) {
            if (doDebug) {
                console.log("END WITH EXCEPTION=>  ".bgWhite.cyan, " ", step_count, func.name.yellow.bold, " => ", err ? err.name.red : "OK".green);
            }
            callback(err);
        }
    };
}

exports.f = f;

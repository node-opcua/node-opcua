"use strict";

var util = require("util");
function dump(obj) {
    console.log("\n", util.inspect(JSON.parse(JSON.stringify(obj)), {colors: true, depth: 10}));
}
exports.dump = dump;

function dumpIf(condition, obj) {

    if (condition) {
        dump(obj);
    }
}
exports.dumpIf = dumpIf;
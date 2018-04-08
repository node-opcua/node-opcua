const util = require("util");

export function dump(obj: any) {
    console.log("\n", util.inspect(JSON.parse(JSON.stringify(obj)), { colors: true, depth: 10 }));
}
export function dumpIf(condition: boolean, obj: any) {
    if (condition) {
        dump(obj);
    }
}

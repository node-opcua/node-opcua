const fs = require("fs");
const hexy = require("hexy");

const bin = fs.readFileSync(process.argv[process.argv.length - 1]);

console.log(hexy.hexy(bin, {width: 32, format: "twos"}));

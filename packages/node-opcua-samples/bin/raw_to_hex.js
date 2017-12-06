var fs = require("fs");
var hexy = require("hexy");

var bin = fs.readFileSync(process.argv[process.argv.length - 1]);

console.log(hexy.hexy(bin, {width: 32, format: "twos"}));

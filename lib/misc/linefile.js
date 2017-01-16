"use strict";
var fs = require("fs");

function LineFile() {
    this.__line = [];

    this.write("// --------- This code has been automatically generated !!! " + (new Date()).toISOString());
}

LineFile.prototype.write = function(...args) {
    var str = "";
    for (var i = 0; i < args.length; i++) {
        str += args[i];
    }
    this.__line.push(str);
};

LineFile.prototype.save = function (filename) {
    fs.writeFileSync(filename, this.__line.join("\n"), "ascii");
};


exports.LineFile = LineFile;

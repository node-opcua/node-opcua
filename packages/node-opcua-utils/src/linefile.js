"use strict";
var fs = require("fs");

function LineFile() {
    this.__line = [];

    this.write("// --------- This code has been automatically generated !!! " + (new Date()).toISOString());
}

LineFile.prototype.write = function () {
    var str = "";
    for (var i = 0; i < arguments.length; i++) {
        str += arguments[i];
    }
    this.__line.push(str);
};

LineFile.prototype.toString = function () {
    return this.__line.join("\n");
};

LineFile.prototype.save = function (filename) {
    fs.writeFileSync(filename, this.toString(), "ascii");
};


exports.LineFile = LineFile;

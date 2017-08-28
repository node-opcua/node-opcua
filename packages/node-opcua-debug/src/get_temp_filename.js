"use strict";

var path = require("path");
var fs = require("fs");
function getTempFilename(tmpfile) {
    tmpfile = tmpfile || "";
    var temporaryFolder = path.join(__dirname,'../../../../tmp/');
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder,tmpfile));
}
exports.getTempFilename = getTempFilename;



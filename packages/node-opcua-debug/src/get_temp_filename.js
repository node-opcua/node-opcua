"use strict";

var path = require("path");
var fs = require("fs");
function getTempFilename(tmpfile) {
    tmpfile = tmpfile || "";

    var this_dirname = __dirname;
    var temporaryFolder = path.join(this_dirname, '../../../../tmp/');
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder,tmpfile));
}
exports.getTempFilename = getTempFilename;



"use strict";

var path = require("path");
function getTempFilename(tmpfile) {
    tmpfile = tmpfile || "";
    return path.normalize(path.join(__dirname,'../../../../tmp/',tmpfile));

}
exports.getTempFilename = getTempFilename;



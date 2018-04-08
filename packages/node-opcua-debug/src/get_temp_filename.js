"use strict";

const path = require("path");
const fs = require("fs");
function getTempFilename(tmpfile) {
    tmpfile = tmpfile || "";

    const this_dirname = __dirname;
    const temporaryFolder = path.join(this_dirname, '../../../../tmp/');
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder,tmpfile));
}
exports.getTempFilename = getTempFilename;



"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTempFilename = void 0;
/**
 * @module node-opcua-debug
 */
const fs = require("fs");
const path = require("path");
function getTempFilename(tmpFilename) {
    tmpFilename = tmpFilename || "";
    const folderOfThisFile = __dirname;
    const temporaryFolder = path.join(folderOfThisFile, "../../../../tmp/");
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder, tmpFilename));
}
exports.getTempFilename = getTempFilename;
//# sourceMappingURL=get_temp_filename.js.map
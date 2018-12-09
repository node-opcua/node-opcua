const path = require("path");
const fs = require("fs");

export function getTempFilename(tmpfile:string|null):string {
    tmpfile = tmpfile || "";
    const this_dirname = __dirname;
    const temporaryFolder = path.join(this_dirname, '../../../../tmp/');
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder,tmpfile));
}




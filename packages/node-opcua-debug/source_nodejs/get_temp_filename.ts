/**
 * @module node-opcua-debug
 */
import fs from "node:fs";
import path from "node:path";

export function getTempFilename(tmpFilename: string | null): string {
    tmpFilename = tmpFilename || "";
    const folderOfThisFile = __dirname;
    const temporaryFolder = path.join(folderOfThisFile, "../../../tmp/");
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder, tmpFilename));
}

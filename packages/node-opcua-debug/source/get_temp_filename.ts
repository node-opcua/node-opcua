/**
 * @module node-opcua-debug
 */
import * as fs from "fs";
import * as path from "path";

export function getTempFilename(tmpFilename: string | null): string {
    tmpFilename = tmpFilename || "";
    const folderOfThisFile = __dirname;
    const temporaryFolder = path.join(folderOfThisFile, "../../../../tmp/");
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder, tmpFilename!));
}

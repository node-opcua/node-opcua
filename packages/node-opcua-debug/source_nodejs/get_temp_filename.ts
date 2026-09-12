/**
 * @module node-opcua-debug
 */
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;

export function getTempFilename(tmpFilename: string | null): string {
    tmpFilename = tmpFilename || "";
    const temporaryFolder = path.join(here, "../../../tmp/");
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder, tmpFilename));
}

/**
 * @module node-opcua-debug
 */
import fs from "node:fs";
import path from "node:path";

// The one place this module learns where it sits on disk. `import.meta.dirname`
// cannot be used while this package emits CommonJS (TS1470), so the ESM migration
// has this single line to change rather than several scattered uses.
const here = __dirname;

export function getTempFilename(tmpFilename: string | null): string {
    tmpFilename = tmpFilename || "";
    const temporaryFolder = path.join(here, "../../../tmp/");
    if (!fs.existsSync(temporaryFolder)) {
        fs.mkdirSync(temporaryFolder);
    }
    return path.normalize(path.join(temporaryFolder, tmpFilename));
}

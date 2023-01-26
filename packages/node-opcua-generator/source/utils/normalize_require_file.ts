import * as path from "path";
// ---------------------------------------------------------------------------------------------------------------------
/**
 * @method normalize_require_file
 * @param baseFolder
 * @param fullPathToFile
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
export function normalize_require_file(baseFolder: string, fullPathToFile: string): string {
    let localFile = path.relative(baseFolder, fullPathToFile).replace(/\\/g, "/");
    // append ./ if necessary
    if (localFile.substring(0, 1) !== ".") {
        localFile = "./" + localFile;
    }
    // remove extension
    localFile = localFile.substring(0, localFile.length - path.extname(localFile).length);
    return localFile;
}

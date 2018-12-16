/**
 * @module node-opcua-types
 */
// tslint:disable:no-console
import * as fs from "fs";
import { generate } from "node-opcua-generator";
import * as path from "path";
import { promisify } from "util";

// const fileExists = promisify(fs.exists);
// const mkdir = promisify(fs.mkdir);
// async function build_generated_folder() {
//
//     const currentFolder = path.join(__dirname, "..");
//     const generatedCodeFolder = path.join(currentFolder, "_generated_");
//
//     const generatedCodeFolderExists = await  fileExists(generatedCodeFolder);
//     if (!generatedCodeFolderExists)  {
//         await mkdir(generatedCodeFolder);
//     }
// }
async function main() {
    try {
        // await build_generated_folder();
        const filename = path.join(__dirname, "../xmlschemas/Opc.Ua.Types.bsd");
        const generatedTypescriptFilename = path.join(__dirname, "_generated_opcua_types.ts");
        await generate(filename, generatedTypescriptFilename);
    } catch (err) {
        console.log(err);
    }
}
main().then().catch();

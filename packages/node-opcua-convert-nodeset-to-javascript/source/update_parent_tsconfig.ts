// Purpose of this script is to help ensure that "references" array in packages/tsconfig.json
// stays up-to-date with nodeset package list.

import { existsSync, promises as fsPromises } from 'fs';
const { readFile, writeFile } = fsPromises;
import path from 'path';
// Uncomment the following to get __dirname equivalent when compiling to ESM
//import { fileURLToPath } from 'url';
//const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { nodesetCatalog } from "node-opcua-nodesets";

export async function updateParentTSConfig() {
    const packagesFolder = path.join(__dirname, '..', '..');
    const parentTSConfigFile = path.join(packagesFolder, 'tsconfig.json');
    console.log(`Updating parent tsconfig.json file: ${parentTSConfigFile}`);
    const content = await readFile(parentTSConfigFile, 'utf8');
    // Strip out comments to avoid JSON parsing error
    const contentWithoutComments = content.replace(/\/\*.+?\*\//g, '')
        .replace(/\/\/.+?$/g, '');
    // TODO: Preserve comments automatically
    let parentTSConfig: any = "";
    try {
        parentTSConfig = JSON.parse(contentWithoutComments);
    } catch (err) {
        console.log(`Error parsing JSON from ${parentTSConfigFile}:`, err);
        console.log('Content without comments:', contentWithoutComments);

        throw err;
    }
    type TSConfigReference = { path: string };
    const unlistedReferences: TSConfigReference[] = [];
    for (const meta of nodesetCatalog) {
        const packageName = `node-opcua-nodeset-${meta.packageName}`;
        const nodesetPackageFolder = path.join(packagesFolder, packageName);
        if (!existsSync(nodesetPackageFolder)) {
            console.log(`Ignoring ${meta.packageName} since package folder does not exist (${nodesetPackageFolder})`);
            continue;
        }
        if (!parentTSConfig.references.some((ref: TSConfigReference) => ref.path === packageName)) {
            console.log(`Found nodeset package that was not listed in tsconfig.json: ${packageName}`);
            unlistedReferences.push({ path: packageName });
        }
    }

    function compareByPath(a: TSConfigReference, b: TSConfigReference) {
        if (a.path < b.path) { return -1; }
        if (a.path > b.path) { return 1; }
        return 0;
    }

    if (unlistedReferences.length > 0) {
        parentTSConfig.references.push(...unlistedReferences);
        parentTSConfig.references.sort(compareByPath);
        // Maintain the compact style `{ "path": "node-opcua-X" }` in references section
        // Also add the comment about Istanbul back
        const newJSON = JSON.stringify(parentTSConfig, null, "    ")
            .replace('"removeComments": false', '"removeComments": false /* to prevent Istanbul ignore statements in comments from disappearing */')
            .replace(/{\s*"path":\s*"([^"]+)"\s*}/g, '{ "path": "$1" }')
            + '\n';
        //console.log('Writing updated tsconfig.json file:', newJSON);
        await writeFile(parentTSConfigFile, newJSON, 'utf8');
    }
}

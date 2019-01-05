/**
 * @module node-opcua-nodesets
 */

import * as fs from "fs";
import * as path from "path";

export function constructNodesetFilename(filename: string) {

    const dirname = __dirname;
    let file = path.join(dirname, "../nodesets", filename);
    if (!fs.existsSync(file)) {
        // let's find alternate places where to find the nodeset folder
        let appfolder = path.dirname(process.argv[1]);
        file = path.join(appfolder, "nodesets", filename);
        if (!fs.existsSync(file)) {
            appfolder = process.cwd();
            file = path.join(appfolder, "nodesets", filename);
        }
    }
    return file;
}

// {{ --------------------------------------------------------------
//   this block is use to force pkg to import nodesets in package
path.join(__dirname, "nodesets/Opc.Ua.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Di.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Adi.NodeSet2.xml");
// ------------------------------------------------------------- }}

export const standardNodeSetFilename = constructNodesetFilename("Opc.Ua.NodeSet2.xml");
export const diNodeSetFilename = constructNodesetFilename("Opc.Ua.Di.NodeSet2.xml");
export const adiNodeSetFilename = constructNodesetFilename("Opc.Ua.Adi.NodeSet2.xml");

export const standard_nodeset_file = standardNodeSetFilename;
export const di_nodeset_filename = diNodeSetFilename;
export const adi_nodeset_filename = adiNodeSetFilename;

export const nodesets = {
    adi: adiNodeSetFilename,
    adiNodeSetFilename,
    adi_nodeset_filename: adiNodeSetFilename,

    di: diNodeSetFilename,
    diNodeSetFilename,
    di_nodeset_filename: diNodeSetFilename,

    standard: standardNodeSetFilename,
    standardNodeSetFilename,
    standard_nodeset_file: standardNodeSetFilename
};

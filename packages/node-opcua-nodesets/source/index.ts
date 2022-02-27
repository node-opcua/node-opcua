/**
 * @module node-opcua-nodesets
 */

import * as fs from "fs";
import * as path from "path";

export function constructNodesetFilename(filename: string) {
    const dirname = __dirname;
    let file = path.join(dirname, "../nodesets", filename);
    if (!fs.existsSync(file)) {
        if (!process.argv[1]) {
            throw new Error(
                `cannot find file ${file}\nPlease make sure that nodeset can be found in ${path.join(dirname, "../nodesets")}`
            );
        }
        // let's find alternate places where to find the nodeset folder
        let appFolder = path.dirname(process.argv[1]);
        file = path.join(appFolder, "nodesets", filename);
        if (!fs.existsSync(file)) {
            appFolder = process.cwd();
            file = path.join(appFolder, "nodesets", filename);
        }
    }
    return file;
}

// {{ --------------------------------------------------------------
//   this block is use to force pkg to import nodesets in package
path.join(__dirname, "nodesets/Opc.Ua.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Di.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Adi.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.AutoID.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.MachineVision.NodeSet2.xml");
path.join(__dirname, "nodesets/Opc.Ua.Robotics.NodeSet2.xml");

// ------------------------------------------------------------- }}

const standardNodeSetFilename = constructNodesetFilename("Opc.Ua.NodeSet2.xml");
const diNodeSetFilename = constructNodesetFilename("Opc.Ua.Di.NodeSet2.xml");
const adiNodeSetFilename = constructNodesetFilename("Opc.Ua.Adi.NodeSet2.xml");
const gdsNodeSetFilename = constructNodesetFilename("Opc.Ua.Gds.NodeSet2.xml");
const autoIdNodeSetFilename = constructNodesetFilename("Opc.Ua.AutoID.NodeSet2.xml");
const roboticsNodeSetFilename = constructNodesetFilename("Opc.Ua.Robotics.NodeSet2.xml");
const machineVisionNodeSetFilename = constructNodesetFilename("Opc.Ua.MachineVision.NodeSet2.xml");
const packMLNodeSetFilename = constructNodesetFilename("Opc.Ua.PackML.NodeSet2.xml");
const machineryNodeSetFilename = constructNodesetFilename("Opc.Ua.Machinery.NodeSet2.xml");
const cncNodeSetFilename = constructNodesetFilename("Opc.Ua.CNC.NodeSet.xml");
const commercialKitchenEquipmentNodeSetFilename = constructNodesetFilename("Opc.Ua.CommercialKitchenEquipment.NodeSet2.xml");
const machineToolNodeSetFilename = constructNodesetFilename("Opc.Ua.MachineTool.NodeSet2.xml");
const iaNodeSetFilename = constructNodesetFilename("Opc.Ua.IA.NodeSet2.xml");
const woodWorkingNodeSetFilename = constructNodesetFilename("Opc.Ua.Woodworking.NodeSet2.xml");
const eumaboisNodeSetFilename = constructNodesetFilename("Opc.Ua.Eumabois.NodeSet2.xml");
const glassNodeSetFilename = constructNodesetFilename("Opc.Ua.Glass.NodeSet2.xml");

export const nodesets = {
    adi: adiNodeSetFilename,

    di: diNodeSetFilename,

    standard: standardNodeSetFilename,

    gds: gdsNodeSetFilename,

    autoId: autoIdNodeSetFilename,

    robotics: roboticsNodeSetFilename,

    machineVision: machineVisionNodeSetFilename,

    packML: packMLNodeSetFilename,

    machinery: machineryNodeSetFilename,

    cnc: cncNodeSetFilename,

    commercialKitchenEquipment: commercialKitchenEquipmentNodeSetFilename,

    ia: iaNodeSetFilename,

    machineTool: machineToolNodeSetFilename,

    woodWorking: woodWorkingNodeSetFilename,

    eumabois: eumaboisNodeSetFilename,

    glass: glassNodeSetFilename
};

function makeDeprecated(id: string, newName: keyof typeof nodesets) {
    Object.defineProperty(nodesets, id, {
        get: () => {
            console.log(`nodeset.${id} is deprecated , please use nodeset.${newName} instead`);
            return nodesets[newName];
        }
    });
}

makeDeprecated("adiNodeSetFilename", "adi");
makeDeprecated("adi_nodeset_filename", "adi");
makeDeprecated("diNodeSetFilename", "di");
makeDeprecated("di_nodeset_filename", "di");
makeDeprecated("standardNodeSetFilename", "standard");
makeDeprecated("standard_nodeset_file", "standard");
makeDeprecated("gdsNodeSetFilename", "gds");
makeDeprecated("gds_nodeset_filename", "gds");

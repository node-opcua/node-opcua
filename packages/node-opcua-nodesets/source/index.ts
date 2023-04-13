/**
 * @module node-opcua-nodesets
 */

import * as fs from "fs";
import * as path from "path";

export enum NodesetName {
    standard = "standard",
    di = "di",
    adi = "adi",
    autoId = "autoId",
    commercialKitchenEquipment = "commercialKitchenEquipment",
    cnc = "cnc",
    eumabois = "eumabois",
    gds = "gds",
    glass = "glass",
    ia = "ia",
    iolink = "iolink",
    iolinkIODD = "iolinkIODD",
    irdi = "irdi",
    machinery = "machinery",
    machineryProcessValues = "machineryProcessValues",
    machineryResult = "machineryResult",
    machineTool = "machineTool",
    machineVision = "machineVision",
    packML = "packML",
    padim = "padim",
    robotics = "robotics",
    tightening = "tightening",
    woodWorking = "woodWorking",
}

export type NodesetMeta = {
    /// used as key in exported nodesets object as well as in index_web.js
    name: NodesetName;
    /// `node-opcua-nodeset-${...}`
    packageName: string;
    /// the official namespace URI
    uri: string;
    /// path to local NodeSet2 XML file
    xmlFile: string;
};


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

// Note: The ordering of these items is not arbitrary since we map this to generate nodesets export.
//       First, we want to ensure that any dependencies of a nodeset are loaded first (precede it in the array).
//       Second, we want to preserve the historical order since this will affect the namespace indices generated
//       when converting to TypeScript. (Not necessarily crucial but would otherwise generate noise in git diffs.)
//       (This order was taken from packages/node-opcua-convert-nodeset-to-javascript/source/main.ts)
//
//       The array after the namespace URI captures the RequiredModels from the NodeSet2.xml for reference.
//       These are not actually used by the program (or exposed as API) but can be helpful for humans checking
//       the order of the items in this list.
//       All nodesets other than "standard" are assumed to depend on "standard" being loaded first, so NodesetName.standard is omitted.
//       By ensuring that dependencies are listed first, one can safely pass a mapping of this entire array
//       as OPCUAServerOptions.nodeset_filename (e.g. when constructing `new OPCUAServer(...)`) without
//       causing an error due to ordering.
export const allNodesetMeta: NodesetMeta[] =
    (<[NodesetName, string, string, string, NodesetName[], boolean?][]>[
        [NodesetName.standard, "ua", "http://opcfoundation.org/UA/", "Opc.Ua.NodeSet2.xml", []],
        [NodesetName.di, "di", "http://opcfoundation.org/UA/DI/", "Opc.Ua.Di.NodeSet2.xml", []],
        [NodesetName.adi, "adi", "http://opcfoundation.org/UA/ADI/", "Opc.Ua.Adi.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.autoId, "auto-id", "http://opcfoundation.org/UA/AutoID/", "Opc.Ua.AutoID.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.machineVision, "machine-vision", "http://opcfoundation.org/UA/MachineVision", "Opc.Ua.MachineVision.NodeSet2.xml", []],
        [NodesetName.commercialKitchenEquipment, "commercial-kitchen-equipment", "http://opcfoundation.org/UA/CommercialKitchenEquipment/", "Opc.Ua.CommercialKitchenEquipment.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.gds, "gds", "http://opcfoundation.org/UA/GDS/", "Opc.Ua.Gds.NodeSet2.xml", []],
        [NodesetName.robotics, "robotics", "http://opcfoundation.org/UA/Robotics/", "Opc.Ua.Robotics.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.machinery, "machinery", "http://opcfoundation.org/UA/Machinery/", "Opc.Ua.Machinery.NodeSet2.xml", []],
        [NodesetName.ia, "ia", "http://opcfoundation.org/UA/IA/", "Opc.Ua.IA.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.machineTool, "machine-tool", "http://opcfoundation.org/UA/MachineTool/", "Opc.Ua.MachineTool.NodeSet2.xml", [NodesetName.di, NodesetName.machinery, NodesetName.ia]],
        [NodesetName.cnc, "cnc", "http://opcfoundation.org/UA/CNC", "Opc.Ua.CNC.NodeSet.xml", []],
        [NodesetName.woodWorking, "woodworking", "http://opcfoundation.org/UA/Woodworking/", "Opc.Ua.Woodworking.NodeSet2.xml", [NodesetName.di, NodesetName.machinery]],
        [NodesetName.glass, "glass-flat", "http://opcfoundation.org/UA/Glass/Flat/", "Opc.Ua.Glass.NodeSet2.xml", [NodesetName.di, NodesetName.machinery]],
        [NodesetName.tightening, "ijt", "http://opcfoundation.org/UA/IJT/", "Opc.Ua.Ijt.Tightening.NodeSet2.xml", [NodesetName.di, NodesetName.machinery]],
        [NodesetName.packML, "pack-ml", "http://opcfoundation.org/UA/PackML/", "Opc.Ua.PackML.NodeSet2.xml", []],
        [NodesetName.eumabois, "eumabois", "http://opcfoundation.org/UA/Eumabois/", "Opc.Ua.Eumabois.NodeSet2.xml", [NodesetName.di, NodesetName.machinery, NodesetName.woodWorking]],
        [NodesetName.iolink, "io-link", "http://opcfoundation.org/UA/IOLink/", "Opc.Ua.IOLink.NodeSet2.xml", [NodesetName.di]],
        [NodesetName.iolinkIODD, "io-link-iodd", "http://opcfoundation.org/UA/IOLink/IODD/", "Opc.Ua.IOLinkIODD.NodeSet2.xml", []],
        [NodesetName.irdi, "irdi", "http://opcfoundation.org/UA/Dictionary/IRDI", "Opc.Ua.IRDI.NodeSet2.xml", []],
        [NodesetName.padim, "padim", "http://opcfoundation.org/UA/PADIM/", "Opc.Ua.PADIM.NodeSet2.xml", [NodesetName.irdi, NodesetName.di]],
        [NodesetName.machineryProcessValues, "machinery-process-values", "http://opcfoundation.org/UA/Machinery/ProcessValues/", "Opc.Ua.Machinery.ProcessValues.NodeSet2.xml", [NodesetName.di, NodesetName.irdi, NodesetName.padim]],
        [NodesetName.machineryResult, "machinery-result", "http://opcfoundation.org/UA/Machinery/Result/", "Opc.Ua.Machinery.Result.NodeSet2.xml", []],
    ])
    .map(([name, packageSuffix, uri, xmlFileName, _requiredModels]) =>
        ({
            name,
            packageName: `node-opcua-nodeset-${packageSuffix}`,
            uri,
            xmlFile: constructNodesetFilename(xmlFileName),
        })
    );

export const nodesets = allNodesetMeta.reduce(
    (nodesetMap, meta) => {
        nodesetMap[meta.name] = meta.xmlFile;
        return nodesetMap;
    }, <Record<NodesetName, string>>{}
);

function makeDeprecated(id: string, newName: keyof typeof nodesets) {
    Object.defineProperty(nodesets, id, {
        get: () => {
            console.log(`nodeset.${id} is deprecated , please use nodeset.${newName} instead`);
            return nodesets[newName];
        }
    });
}

makeDeprecated("adiNodeSetFilename", NodesetName.adi);
makeDeprecated("adi_nodeset_filename", NodesetName.adi);
makeDeprecated("diNodeSetFilename", NodesetName.di);
makeDeprecated("di_nodeset_filename", NodesetName.di);
makeDeprecated("standardNodeSetFilename", NodesetName.standard);
makeDeprecated("standard_nodeset_file", NodesetName.standard);
makeDeprecated("gdsNodeSetFilename", NodesetName.gds);
makeDeprecated("gds_nodeset_filename", NodesetName.gds);

import * as path from "path";
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { convertNamespaceTypeToTypescript } from "./convert_namespace_to_typescript";

async function main() {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [
        nodesets.standard,
        nodesets.di,
        nodesets.adi,
        nodesets.autoId,
        nodesets.machineVision,
        nodesets.commercialKitchenEquipment,
        nodesets.gds,
        nodesets.robotics,
        nodesets.machinery,
        nodesets.ia,
        nodesets.machineTool,
        nodesets.cnc,
        nodesets.woodWorking,
        nodesets.glass,
        nodesets.tightening,
        nodesets.packML,
        nodesets.eumabois,
        nodesets.iolink,
        nodesets.iolinkIODD,
        nodesets.irdi,
        nodesets.padim,
        nodesets.machineryProcessValues,
        nodesets.machineryResult,
    ]);
    const nsUA = 0;
    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
    const nsMachineVision = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineVision");
    const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
    const nsGds = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/GDS/");
    const nsRobotics = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Robotics/");
    const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
    const nsIA = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IA/");
    const nsMachineTool = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineTool/");
    const ncCNC = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");
    const nsCommercialKitchenEquipment = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
    const nsWW = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Woodworking/");
    const nsGlass = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Glass/Flat/");
    const nsTightening = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IJT/");
    const nsPackML = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/PackML/");
    const nsEumabois = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Eumabois/");
    const nsIOLink = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IOLink/");
    const nsIOLinkIODD = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/IOLink/IODD/");
    const nsIRDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Dictionary/IRDI");
    const nsPADIM = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/PADIM/");
    const nsMachineryProcessValues = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/ProcessValues/");
    const nsMachineryResult = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/Result/");

    const session = new PseudoSession(addressSpace);
    const options = {
        baseFolder: path.join(__dirname, "../../"),
        prefix: "node-opcua-nodeset-"
    };

    const promises: Promise<void>[] = [
        convertNamespaceTypeToTypescript(session, nsUA, options),
        convertNamespaceTypeToTypescript(session, nsDI, options),
        convertNamespaceTypeToTypescript(session, nsADI, options),
        convertNamespaceTypeToTypescript(session, nsMachineVision, options),
        convertNamespaceTypeToTypescript(session, nsAutoId, options),
        convertNamespaceTypeToTypescript(session, nsGds, options),
        convertNamespaceTypeToTypescript(session, nsRobotics, options),
        convertNamespaceTypeToTypescript(session, nsMachinery, options),
        convertNamespaceTypeToTypescript(session, nsIA, options),
        convertNamespaceTypeToTypescript(session, nsMachineTool, options),
        convertNamespaceTypeToTypescript(session, ncCNC, options),
        convertNamespaceTypeToTypescript(session, nsCommercialKitchenEquipment, options),
        convertNamespaceTypeToTypescript(session, nsWW, options),
        convertNamespaceTypeToTypescript(session, nsGlass, options),
        convertNamespaceTypeToTypescript(session, nsTightening, options),
        convertNamespaceTypeToTypescript(session, nsPackML, options),
        convertNamespaceTypeToTypescript(session, nsEumabois, options),
        convertNamespaceTypeToTypescript(session, nsIOLink, options),
        convertNamespaceTypeToTypescript(session, nsIOLinkIODD, options),
        convertNamespaceTypeToTypescript(session, nsIRDI, options),
        convertNamespaceTypeToTypescript(session, nsPADIM, options),
        convertNamespaceTypeToTypescript(session, nsMachineryProcessValues, options),
        convertNamespaceTypeToTypescript(session, nsMachineryResult, options),
    ];
    await Promise.all(promises);
}
void main();

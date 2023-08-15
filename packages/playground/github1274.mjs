// @ts-check 
import { OPCUAServer, coerceQualifiedName, nodesets } from "node-opcua";
/// <reference types="node-opcua" />

/**
 * @param  {import("node-opcua").IAddressSpace} addressSpace
 */
async function constructAddressSpace(addressSpace) {

    // https://reference.opcfoundation.org/Machinery/v102/docs/6

    const namespace = addressSpace.getOwnNamespace();

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (nsDI === -1) {
        throw new Error("Cannot find namespace for DI");
    }
    const deviceSet = addressSpace.rootFolder.objects.getFolderElementByName("DeviceSet", nsDI);
    if (!deviceSet) {
        throw new Error("Cannot find DeviceSet");
    }

    const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
    if (nsMachinery === -1) {
        throw new Error("Cannot find namespace for Machinery");
    }
    const nsMachineTool = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineTool/");
    if (nsMachineTool === -1) {
        throw new Error("Cannot find namespace for MachineTool");
    }
    const machineToolType = addressSpace.findObjectType("MachineToolType", nsMachineTool);
    if (!machineToolType) {
        throw new Error("Cannot find MachineToolType");
    }

    const machineTool = machineToolType.instantiate({
        browseName: "MachineTool",
        organizedBy: deviceSet,
        optionals: ["Identification", "Components", "MachineryBuildingBlocks", "MachineryBuildingBlocks"]
    });

    const machineryBuildingBlocks = machineTool.getComponentByName("MachineryBuildingBlocks", nsMachinery);
    if (!machineryBuildingBlocks) {
        throw new Error("Cannot find MachineryBuildingBlocks");
    }

    const identification = machineTool.getChildByName("Identification", nsMachineTool);
    if (!identification) {
        throw new Error("Cannot find Identification");
    }
    machineryBuildingBlocks.addReference({
        referenceType: "HasAddIn",
        nodeId: identification
    });
    const components = machineTool.getComponentByName("Components", nsMachinery);
    if (!components) {
        throw new Error("Cannot find MachineryBuildingBlocks.Components");
    }

    machineryBuildingBlocks.addReference({
        referenceType: "HasAddIn",
        nodeId: components
    });

    // add some components
    const baseObjectType = addressSpace.findObjectType("BaseObjectType", 0);
    if (!baseObjectType) {
        throw new Error("Cannot find BaseObjectType");
    }
    const component1 = baseObjectType.instantiate({
        browseName: "Component1",
        componentOf: components
    });

    // add some building blocks
    const buildingBlock1Type = namespace.addObjectType({
        browseName: "BuildingBlock1Type",
        subtypeOf: "BaseObjectType"
    });

    const buildingBlock1 = buildingBlock1Type.instantiate({
        browseName: "BuildingBlock1",
        //  addInOf: machineryBuildingBlocks // DOES NOT EXIST YET !!
    });
    // ... so we create it this way
    machineryBuildingBlocks.addReference({
        referenceType: "HasAddIn",
        nodeId: buildingBlock1
    });


    const buildingBlock2Type = namespace.addObjectType({
        browseName: "BuildingBlock2Type",
        subtypeOf: "BaseObjectType"
    });
    const buildingBlock2 = buildingBlock2Type.instantiate({
        browseName: "BuildingBlock2",
        //  addInOf: machineryBuildingBlocks // DOES NOT EXIST YET !!
    });
    // ... so we create it this way
    machineryBuildingBlocks.addReference({
        referenceType: "HasAddIn",
        nodeId: buildingBlock2
    });

}



/**
 * 
 * an other flavor not use
 * @param  {import("node-opcua").IAddressSpace} addressSpace
 */
async function constructAddressSpace2(addressSpace) {

    // https://reference.opcfoundation.org/Machinery/v102/docs/6

    const namespace = addressSpace.getOwnNamespace();

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (nsDI === -1) {
        throw new Error("Cannot find namespace for DI");
    }
    const deviceSet = addressSpace.rootFolder.objects.getFolderElementByName("DeviceSet", nsDI);
    if (!deviceSet) {
        throw new Error("Cannot find DeviceSet");
    }

    const nsMachineTool = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineTool/");
    if (nsMachineTool === -1) {
        throw new Error("Cannot find namespace for MachineTool");
    }
    const machineToolType = addressSpace.findObjectType("MachineToolType", nsMachineTool);
    if (!machineToolType) {
        throw new Error("Cannot find MachineToolType");
    }

    const machineTool = machineToolType.instantiate({
        browseName: "MachineTool2",
        organizedBy: deviceSet,
    });
  
    const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
    if (nsMachinery === -1) {
        throw new Error("Cannot find namespace for Machinery");
    }
    const machineryBuildingBlocks = namespace.addObject({
        browseName: {name : "MachineryBuildingBlocks", namespaceIndex: nsMachinery},
        typeDefinition: "FolderType",
        componentOf: machineTool
    });

    const identification = machineTool.getChildByName("Identification", nsMachineTool);
    if (!identification) {
        throw new Error("Cannot find Identification");
    }
    machineryBuildingBlocks.addReference({
        referenceType: "HasAddIn",
        nodeId: identification
    });
    const components = machineTool.getComponentByName("Components", nsMachinery);
}

(async () => {
    const server = new OPCUAServer({
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.machinery,
            nodesets.machineTool
        ]

    });

    await server.initialize();
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) { throw new Error("Internal Error"); }

    constructAddressSpace(addressSpace);
    constructAddressSpace2(addressSpace);

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));

    await server.shutdown();
    console.log("Server has shut down");
})();

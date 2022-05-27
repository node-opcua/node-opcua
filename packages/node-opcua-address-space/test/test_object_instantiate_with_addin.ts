import * as should from "should";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";

import { AddressSpace, SessionContext, UAObject } from "..";
import { generateAddressSpace } from "../distNodeJS";

const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UAObjectType", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.machinery,
            nodesets.machineTool
        ]);
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("UAObjectType with AddIn", () => {
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) throw new Error("namespace http://opcfoundation.org/UA/DI/ not found");

        const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
        if (nsMachinery < 0) throw new Error("namespace http://opcfoundation.org/UA/Machinery/ not found");

        const nsMachineTool = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineTool/");
        if (nsMachineTool < 0) throw new Error("namespace http://opcfoundation.org/UA/MachineTool/ not found");

        const machinesFolder = addressSpace.rootFolder.objects.getFolderElementByName("Machines", nsMachinery)! as UAObject;
        if (!machinesFolder) throw new Error("machinesFolder not found");

        const machineToolType = addressSpace.findObjectType("MachineToolType", nsMachineTool);
        if (!machineToolType) throw new Error("MachineToolType not found");
        //instantiate node
        const machineTool = machineToolType.instantiate({
            browseName: "Machine",
            nodeId: `s=Machine`,
            componentOf: machinesFolder,
            optionals: [
                // ----------------
                "Identification.AssetId",
                "Identification.ComponentName"
            ]
        });

        const identification = machineTool.getComponentByName("Identification", nsDI)!;
        should.exist(identification, "Identification must exist");

        console.log(machineTool.toString());
        console.log(identification.toString());

        should.exist(identification.getChildByName("ComponentName", nsDI));
        should.exist(identification.getChildByName("AssetId", nsDI));

        should.not.exist(machineTool.getChildByName("ComponentName"), "ComponentName node should not appear on the machine");
        should.not.exist(machineTool.getChildByName("AssetId"), "AssetId node should not appear on the machine");
    });
});

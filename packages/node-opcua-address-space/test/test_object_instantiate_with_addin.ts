import should from "should";
import { BrowseDirection } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";

import { AddressSpace, SessionContext, UAObject } from "..";
import { addDefaultInstanceBrowseName, instantiateAddIn } from "..";
import { generateAddressSpace } from "../distNodeJS";

const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UAObjectType instantiate with addins", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.isa95JobControl,
            nodesets.machinery,
            nodesets.machineryJobs,
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

        const addins = machineToolType.findReferencesExAsObject("HasAddIn", BrowseDirection.Forward)!;

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



describe("testing addins - case 1", () => {

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [
            nodesets.standard]
        );
    });
    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });



    it("should create a type that has a AddIn", async () => {

        const namespace1 = addressSpace.registerNamespace("Model");


        const jobManagementType = namespace1.addObjectType({
            browseName: "JobManagementType",
            subtypeOf: "BaseObjectType",
            description: "JobManagementType",
        });

        addDefaultInstanceBrowseName(jobManagementType, "JobManager");
        namespace1.addObject({
            componentOf: jobManagementType,
            browseName: "JobOrderControl",
            typeDefinition: "FolderType",   
            modellingRule: "Mandatory"
        });
        namespace1.addObject({
            componentOf: jobManagementType,
            browseName: "JobOrderResults",
            typeDefinition: "FolderType",
            modellingRule: "Mandatory"
        });


        const machineType = namespace1.addObjectType({
            browseName: "MachineType",
            subtypeOf: "BaseObjectType",
            description: "MachineType",
        });

        instantiateAddIn(jobManagementType, {
            addInOf: machineType,
            modellingRule: "Mandatory"
        });

        // now instantiate a machine
        const namespace2 = addressSpace.registerNamespace("Instance");

        const machine = machineType.instantiate({
            browseName: "Machine",
            organizedBy: addressSpace.rootFolder.objects,
            namespace: namespace2
        });

        doDebug && console.log(machine.toString());
        doDebug && console.log(machine.getChildByName("JobManager",2)!.toString());
    });

});

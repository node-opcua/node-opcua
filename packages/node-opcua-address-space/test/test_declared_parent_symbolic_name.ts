import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, setSymbols, type UAObjectType, type UAVariableType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * The declared parent names the node it declares.
 *
 * Since the loader honours `ParentNodeId`, a folder a type only organizes has
 * that type for parent, and its children are named through it
 * (`DeviceType_BuildingBlocks_Counter`). The folder itself was not: the
 * NodeIdManager built a new node's symbolic name from its inverse *aggregating*
 * references only, so it was `BuildingBlocks` where the OPC Foundation's
 * ModelCompiler writes `DeviceType_BuildingBlocks` in NodeIds.csv — and a
 * modeler seeding its ids from that table could not match it. instantiate()
 * also dropped `parentNodeId`, so a declared parent could not reach a node built
 * from a type at all.
 */
describe("the declared parent names the node (NodeIdManager, instantiate)", () => {
    let addressSpace: AddressSpace;
    let deviceType: UAObjectType;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        deviceType = ns.addObjectType({ browseName: "DeviceType" });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const names = () => getSymbols(addressSpace.getOwnNamespace()).map((s) => s[0]);

    it("DPSN-1 an organized folder declared with parentNodeId is named after its declared parent", () => {
        const ns = addressSpace.getOwnNamespace();
        const folder = ns.addObject({
            browseName: "BuildingBlocks",
            organizedBy: deviceType,
            parentNodeId: deviceType,
            typeDefinition: "FolderType",
            modellingRule: "Mandatory"
        });
        ns.addVariable({ browseName: "Counter", componentOf: folder, dataType: "UInt32", modellingRule: "Mandatory" });

        should(names()).containEql("DeviceType_BuildingBlocks");
        should(names()).containEql("DeviceType_BuildingBlocks_Counter");
        should(names()).not.containEql("BuildingBlocks");
    });

    it("DPSN-2 without a declaration an organized node keeps its own name (Organizes is not a parent relation)", () => {
        const ns = addressSpace.getOwnNamespace();
        ns.addObject({ browseName: "Loose", organizedBy: deviceType, typeDefinition: "FolderType" });
        should(names()).containEql("Loose");
        should(names()).not.containEql("DeviceType_Loose");
    });

    it("DPSN-3 UAObjectType.instantiate forwards parentNodeId: parent, ParentNodeId and name follow it", () => {
        const folderType = addressSpace.findObjectType("FolderType");
        if (!folderType) throw new Error("FolderType not found");
        const folder = folderType.instantiate({
            browseName: "BuildingBlocks",
            organizedBy: deviceType,
            parentNodeId: deviceType,
            modellingRule: "Mandatory"
        });

        should(folder.parentNodeId?.toString()).eql(deviceType.nodeId.toString());
        should(names()).containEql("DeviceType_BuildingBlocks");
        const xml = addressSpace.getOwnNamespace().toNodeset2XML();
        should(xml).match(/BrowseName="1:BuildingBlocks" ParentNodeId="ns=1;i=1000"/);
    });

    it("DPSN-4 UAVariableType.instantiate forwards parentNodeId too", () => {
        const ns = addressSpace.getOwnNamespace();
        const sampleType: UAVariableType = ns.addVariableType({ browseName: "SampleType", dataType: "Double" });
        const sample = sampleType.instantiate({
            browseName: "Sample",
            organizedBy: deviceType,
            parentNodeId: deviceType,
            modellingRule: "Mandatory"
        });
        should(sample.parentNodeId?.toString()).eql(deviceType.nodeId.toString());
        should(names()).containEql("DeviceType_Sample");
    });

    it("DPSN-5 when the declared parent is also the aggregating parent, the name is unchanged", () => {
        const ns = addressSpace.getOwnNamespace();
        ns.addVariable({
            browseName: "Level",
            componentOf: deviceType,
            parentNodeId: deviceType,
            dataType: "Double",
            modellingRule: "Mandatory"
        });
        should(names()).containEql("DeviceType_Level");
    });
});

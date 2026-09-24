import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, setSymbols, type UAMethod, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * A member that a folder of the type only organizes, while another member owns it.
 *
 * OPC 30100 IO-Link: IOLinkDeviceType/General organizes MethodSet/ApplicationReset. General is
 * declared first, so instantiate() reached the Method through the Organizes reference before the
 * MethodSet clone existed: the clone was parentless, named "ApplicationReset" alone, and missed
 * the id a preset table gives Device_MethodSet_ApplicationReset. It is now left to its owner,
 * and the folder's reference is added once the tree is cloned.
 */
describe("a member organized by one node and owned by another (instantiate)", () => {
    let addressSpace: AddressSpace;
    let deviceType: UAObjectType;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const ns = addressSpace.getOwnNamespace();
        setSymbols(ns, [["Device_MethodSet_ApplicationReset", 2003, "Method"]]);

        deviceType = ns.addObjectType({ browseName: "DeviceType" });
        // declared first, so cloned first
        const general = ns.addObject({
            browseName: "General",
            componentOf: deviceType,
            typeDefinition: "FolderType",
            modellingRule: "Mandatory"
        });
        const methodSet = ns.addObject({ browseName: "MethodSet", componentOf: deviceType, modellingRule: "Mandatory" });
        const reset = ns.addMethod(methodSet, { browseName: "ApplicationReset", modellingRule: "Mandatory" });
        general.addReference({ referenceType: "Organizes", nodeId: reset });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const organized = (folder: UAObject) => folder.findReferencesAsObject("Organizes", true);

    it("OMOE-1 the clone is its owner's, named after it, and the folder organizes that same clone", () => {
        const device = deviceType.instantiate({ browseName: "Device", organizedBy: addressSpace.rootFolder.objects });
        const methodSet = device.getComponentByName("MethodSet") as UAObject;
        const general = device.getComponentByName("General") as UAObject;
        const reset = methodSet.getMethodByName("ApplicationReset") as UAMethod;

        should(reset).be.ok();
        should(reset.nodeId.toString()).eql(`ns=${addressSpace.getOwnNamespace().index};i=2003`);
        should(reset.parentNodeId?.toString()).eql(methodSet.nodeId.toString());
        should(organized(general).map((n) => n.nodeId.toString())).eql([reset.nodeId.toString()]);
        const name = getSymbols(addressSpace.getOwnNamespace()).find(([, id]) => id === reset.nodeId.value)?.[0];
        should(name).eql("Device_MethodSet_ApplicationReset");
    });

    it("OMOE-2 a member its owner does not clone is still cloned through the folder, as before", () => {
        const ns = addressSpace.getOwnNamespace();
        // the owner is Optional and not requested
        const otherType = ns.addObjectType({ browseName: "OtherType" });
        const folder = ns.addObject({
            browseName: "Shortcuts",
            componentOf: otherType,
            typeDefinition: "FolderType",
            modellingRule: "Mandatory"
        });
        const owner = ns.addObject({ browseName: "Commands", componentOf: otherType, modellingRule: "Optional" });
        const start = ns.addMethod(owner, { browseName: "Start", modellingRule: "Mandatory" });
        folder.addReference({ referenceType: "Organizes", nodeId: start });

        const other = otherType.instantiate({ browseName: "Other", organizedBy: addressSpace.rootFolder.objects });
        should(other.getComponentByName("Commands")).eql(null);
        const shortcuts = other.getComponentByName("Shortcuts") as UAObject;
        should(organized(shortcuts).map((n) => n.browseName.toString())).eql(["1:Start"]);
    });
});

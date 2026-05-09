import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

function git1277(addressSpace: AddressSpace) {
    const namespace = addressSpace.getOwnNamespace();

    //PipeFolderType
    const pipeFolderType = namespace.addObjectType({
        browseName: "PipeFolderType",
        subtypeOf: "FolderType"
    });

    const propertyType = addressSpace.findNode("ns=0;i=68")!;

    const _size = namespace.addVariable({
        browseName: "Size",
        organizedBy: pipeFolderType,
        typeDefinition: propertyType.nodeId,
        dataType: DataType.String,
        modellingRule: "Mandatory"
    });

    const _valve = namespace.addVariable({
        browseName: "Valve",
        organizedBy: pipeFolderType,
        typeDefinition: "BaseDataVariableType",
        dataType: DataType.Boolean,
        modellingRule: "Mandatory"
    });

    //BoilerType
    const boilerType = namespace.addObjectType({
        browseName: "BoilerType"
    });

    const _inputPipe = pipeFolderType.instantiate({
        browseName: "InputPipe",
        modellingRule: "Mandatory",
        organizedBy: boilerType
    });

    const _outputPipe = pipeFolderType.instantiate({
        browseName: "OutputPipe",
        modellingRule: "Mandatory",
        organizedBy: boilerType
    });

    const objectFolder = namespace.addFolder("ObjectsFolder", {
        //Folder
        browseName: "Devices"
    });

    const myBoiler = boilerType.instantiate({
        browseName: "MyBoiler",
        organizedBy: objectFolder
    });
    return myBoiler;
}

describe("github #1277", () => {
    it("should not crash when constructing a ObjectType containing 2 Folders", async () => {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("Private");
        try {
            git1277(addressSpace);
        } catch (err) {
            console.log(err);
            should.not.exist(err, `Expecting no error here ${(err as Error).message}`);
        } finally {
            addressSpace.dispose();
        }
    });
});

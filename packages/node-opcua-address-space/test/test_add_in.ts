import * as should from "should";
import { nodesets } from "node-opcua-nodesets";

import { AddressSpace, UAReferenceType } from "..";
import { generateAddressSpace } from "../distNodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddIns", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.ia,
            nodesets.machinery,
            nodesets.machineTool
        ]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("Reference", () => {
        const hasAddIn = addressSpace.findNode("HasAddIn")! as UAReferenceType;
        const aggregates = addressSpace.findNode("Aggregates")! as UAReferenceType;
        hasAddIn.isSubtypeOf(aggregates).should.eql(true);
    });
    it("AddIns", () => {
        const nsMachinery = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
        const nsMachineTool = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/MachineTool/");
        if (nsMachinery === -1) throw new Error("namespace not found");
        if (nsMachineTool === -1) throw new Error("namespace not found");

        const machineToolType = addressSpace.findObjectType("MachineToolType", nsMachineTool);

        const machineTool = machineToolType.instantiate({
            browseName: "MachineTool",
            organizedBy: addressSpace.rootFolder.objects.getFolderElementByName("Machines", nsMachineTool),
            optionals: [
                "Identification.DeviceClass",
                "Identification.SoftwareIdentification",
                "Identification.HardwareRevision",
                "Identification.SoftwareRevision",
                "Identification.Manufacturer",
                "Identification.MonthOfConstruction",
                "Identification.YearOfConstruction",
                "Identification.ProductCode",
                "Identification.SerialNumber",
                "Identification.AssetId",
                "Identification.ComponentName",
                "Identification.Location",
                "Identification.InitialOperationDate",
                "Identification.ProductInstanceUri"
            ]
        }) as any;

        console.log(machineTool.toString());
        console.log(machineTool.identification.toString());

        should.exist(machineTool.identification.deviceClass, "deviceClass must exist");
        should.exist(machineTool.identification.softwareIdentification, "softwareIdentification must exist");
        should.exist(machineTool.identification.hardwareRevision);
        should.exist(machineTool.identification.manufacturer);
        should.exist(machineTool.identification.monthOfConstruction);
        should.exist(machineTool.identification.yearOfConstruction);
        should.exist(machineTool.identification.productCode);
        should.exist(machineTool.identification.serialNumber);
        should.exist(machineTool.identification.assetId);
        should.exist(machineTool.identification.componentName);
        should.exist(machineTool.identification.location);
        should.exist(machineTool.identification.initialOperationDate);
        should.exist(machineTool.identification.productInstanceUri);
    });
});

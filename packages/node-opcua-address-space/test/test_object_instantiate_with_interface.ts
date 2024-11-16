import should from "should";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, implementInterface } from "..";
import { generateAddressSpace } from "../distNodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing object instantiation with Interfaces - case 1", () => {

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


    it("should create a type implements an interface", async () => {

        const namespace1 = addressSpace.registerNamespace("Model");

        // #region Define IVendorPlateType
        const iVendorPlateType = namespace1.addObjectType({
            browseName: "IVendorPlateType",
            subtypeOf: "BaseInterfaceType",
            description: "IVendorPlateType description",
        });
        const productName = namespace1.addVariable({
            propertyOf: iVendorPlateType,
            browseName: "ProductName",
            dataType: "String",
            description: "ProductName description",
            modellingRule: "Mandatory"
        });
        const serialNumber = namespace1.addVariable({
            propertyOf: iVendorPlateType,
            browseName: "SerialNumber",
            dataType: "String",
            description: "SerialNumber description",
            modellingRule: "Mandatory"
        });
        const softwareRevision = namespace1.addVariable({
            propertyOf: iVendorPlateType,
            browseName: "SoftwareRevision",
            dataType: "String",
            description: "SoftwareRevision description",
            modellingRule: "Optional"
        });
        // #endregion

        // #region define IVendorPlateTypeExtended
        const iVendorPlateTypeExtended = namespace1.addObjectType({
            browseName: "IVendorPlateTypeExtended",
            subtypeOf: iVendorPlateType,
            description: "IVendorPlateTypeExtended description",
        });
        const Manufacturer = namespace1.addVariable({
            propertyOf: iVendorPlateTypeExtended,
            browseName: "Manufacturer",
            dataType: "String",
            description: "Manufacturer description",
            modellingRule: "Mandatory"
        });
        // #endregion

        // #region define MachineType that implements IVendorPlateTypeExtended
        const machineType = namespace1.addObjectType({
            browseName: "MachineType",
            subtypeOf: "BaseObjectType",
            description: "MachineType",
        });

        implementInterface(machineType, iVendorPlateTypeExtended);
        // #endregion

        // #region now instantiate a machine
        const namespace2 = addressSpace.registerNamespace("Instance");

        const machine = machineType.instantiate({
            browseName: "Machine",
            organizedBy: addressSpace.rootFolder.objects,
            namespace: namespace2
        });
        // #endregion
        doDebug && debugLog(machineType.toString());

        doDebug && debugLog(machine.toString());

        should.exist(machine.getChildByName("ProductName", 2));
        should.exist(machine.getChildByName("SerialNumber", 2));
        should.exist(machine.getChildByName("Manufacturer", 2));
        should.not.exist(machine.getChildByName("SoftwareRevision", 2));


    });

});

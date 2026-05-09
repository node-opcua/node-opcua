import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, implementInterface } from "..";
import { generateAddressSpace } from "../distNodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("testing object instantiation with Interfaces - case 1", () => {
    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("INT-01 should create a type implements an interface", async () => {
        const namespace1 = addressSpace.registerNamespace("Model");

        // #region Define IVendorPlateType
        const iVendorPlateType = namespace1.addObjectType({
            browseName: "IVendorPlateType",
            subtypeOf: "BaseInterfaceType",
            description: "IVendorPlateType description"
        });
        const _productName = namespace1.addVariable({
            propertyOf: iVendorPlateType,
            browseName: "ProductName",
            dataType: "String",
            description: "ProductName description",
            modellingRule: "Mandatory"
        });
        const _serialNumber = namespace1.addVariable({
            propertyOf: iVendorPlateType,
            browseName: "SerialNumber",
            dataType: "String",
            description: "SerialNumber description",
            modellingRule: "Mandatory"
        });
        const _softwareRevision = namespace1.addVariable({
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
            description: "IVendorPlateTypeExtended description"
        });
        const _Manufacturer = namespace1.addVariable({
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
            description: "MachineType"
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

    it("INT-02 should expose optional interface members that are in the optionals property", async () => {
        const uaInterface1 = addressSpace.getOwnNamespace().addObjectType({
            browseName: "UAInterface1",
            subtypeOf: "BaseInterfaceType"
        });
        const _optionalVariable1 = addressSpace.getOwnNamespace().addVariable({
            propertyOf: uaInterface1,
            browseName: "OptionalVariable1",
            dataType: "String",
            modellingRule: "Optional"
        });
        const _optionalVariable2 = addressSpace.getOwnNamespace().addVariable({
            propertyOf: uaInterface1,
            browseName: "OptionalVariable2",
            dataType: "String",
            modellingRule: "Optional"
        });

        const uaObjectType1 = addressSpace.getOwnNamespace().addObjectType({
            browseName: "UAObjectType1",
            subtypeOf: "BaseObjectType"
        });
        implementInterface(uaObjectType1, uaInterface1);

        //
        const uaObject1 = uaObjectType1.instantiate({
            browseName: "UAObject1",
            organizedBy: addressSpace.rootFolder.objects,
            optionals: ["OptionalVariable1"]
        });

        should.exist(uaObject1.getChildByName("OptionalVariable1", 1), "OptionalVariable1 should be exposed");
        should.not.exist(uaObject1.getChildByName("OptionalVariable2", 1), "OptionalVariable2 should not be exposed");

        const uaObject2 = uaObjectType1.instantiate({
            browseName: "UAObject2",
            organizedBy: addressSpace.rootFolder.objects,
            optionals: ["OptionalVariable2"]
        });

        should.not.exist(uaObject2.getChildByName("OptionalVariable1", 1), "OptionalVariable1 should not be exposed");
        should.exist(uaObject2.getChildByName("OptionalVariable2", 1), "OptionalVariable2 should be exposed");
    });
});

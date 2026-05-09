import { describe } from "mocha";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, implementInterface } from "..";
import { generateAddressSpace } from "../nodeJS";

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

    function addIVendorPlateType(namespace1: ReturnType<AddressSpace["registerNamespace"]>) {
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
    }

    it("INT-01 should create a type implements an interface", async () => {
        const namespace1 = addressSpace.registerNamespace("Model");

        addIVendorPlateType(namespace1);

        const iVendorPlateTypeExtended = namespace1.findObjectType("IVendorPlateTypeExtended");
        if (!iVendorPlateTypeExtended) throw new Error("cannot find IVendorPlateTypeExtended");

        // #region define MachineType that implements IVendorPlateTypeExtended
        const machineType = namespace1.addObjectType({
            browseName: "MachineType",
            subtypeOf: "BaseObjectType",
            description: "MachineType"
        });

        implementInterface(machineType, iVendorPlateTypeExtended, []);

        should.exist(machineType.getChildByName("ProductName", 2));
        should.exist(machineType.getChildByName("SerialNumber", 2));
        should.exist(machineType.getChildByName("Manufacturer", 2));
        should.exist(machineType.getChildByName("SoftwareRevision", 2));

        should(machineType.getChildByName("ProductName", 2)?.modellingRule).eql("Mandatory");
        should(machineType.getChildByName("SerialNumber", 2)?.modellingRule).eql("Mandatory");
        should(machineType.getChildByName("Manufacturer", 2)?.modellingRule).eql("Mandatory");
        should(machineType.getChildByName("SoftwareRevision", 2)?.modellingRule).eql("Optional");

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

        // #region now instantiate a machine with optionals
        const machine2 = machineType.instantiate({
            browseName: "Machine2",
            organizedBy: addressSpace.rootFolder.objects,
            namespace: namespace2,
            optionals: ["SoftwareRevision"]
        });
        // #endregion
        doDebug && debugLog(machine2.toString());

        should.exist(machine2.getChildByName("ProductName", 2));
        should.exist(machine2.getChildByName("SerialNumber", 2));
        should.exist(machine2.getChildByName("Manufacturer", 2));
        should.exist(machine2.getChildByName("SoftwareRevision", 2));
    });

    it("INT-02 should create a instances that implements an interface", async () => {
        const namespace1 = addressSpace.registerNamespace("Model");

        addIVendorPlateType(namespace1);

        const iVendorPlateTypeExtended = namespace1.findObjectType("IVendorPlateTypeExtended");
        if (!iVendorPlateTypeExtended) throw new Error("cannot find IVendorPlateTypeExtended");

        // #region now instantiate a machine
        const namespace2 = addressSpace.registerNamespace("Instance");

        const baseObjectType = addressSpace.findObjectType("BaseObjectType");
        if (!baseObjectType) throw new Error("cannot find BaseObjectType");

        const machine = baseObjectType.instantiate({
            browseName: "Machine",
            organizedBy: addressSpace.rootFolder.objects,
            namespace: namespace2
        });
        implementInterface(machine, iVendorPlateTypeExtended, ["SoftwareRevision"]);
        // #endregion

        doDebug && debugLog(machine.toString());

        should.exist(machine.getChildByName("ProductName", 2));
        should.exist(machine.getChildByName("SerialNumber", 2));
        should.exist(machine.getChildByName("Manufacturer", 2));
        should.exist(machine.getChildByName("SoftwareRevision", 2));
    });

    function addInterfaceWith2Optionals(addressSpace: AddressSpace) {
        // UAInterface1 {
        //    OptionalVariable1 (optional)
        //    OptionalVariable2 (optional)
        // }
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
        return uaInterface1;
    }
    it("INT-03 should expose optional interface members that are in the optionals property", async () => {
        const uaInterface1 = addInterfaceWith2Optionals(addressSpace);

        const uaObjectType1 = addressSpace.getOwnNamespace().addObjectType({
            browseName: "UAObjectType1",
            subtypeOf: "BaseObjectType"
        });
        implementInterface(uaObjectType1, uaInterface1, []);

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

    it("INT-04 should instantiate an object with optionals,  of a type that implements an interface with no override", async () => {
        const uaInterface1 = addInterfaceWith2Optionals(addressSpace);

        // #region define a object type that implements the interface
        const uaObjectType1 = addressSpace.getOwnNamespace().addObjectType({
            browseName: "UAObjectType1",
            subtypeOf: "BaseObjectType"
        });

        // using simply add Reference to implement the interface should work as well
        uaObjectType1.addReference({
            nodeId: uaInterface1,
            referenceType: "HasInterface"
        });
        // #endregion

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

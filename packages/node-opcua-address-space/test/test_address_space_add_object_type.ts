import * as should from "should";

import { assert } from "node-opcua-assert";
import { DataType } from "node-opcua-variant";

import { AddressSpace, InstantiateObjectOptions, Namespace, UAObject, UAObjectType, UAVariable } from "..";

import { NodeClass } from "node-opcua-data-model";
import { getMiniAddressSpace } from "../testHelpers";
import { createCameraType } from "./fixture_camera_type";
import { createTemperatureSensorType, TemperatureSensor, TemperatureSensorType } from "./fixture_temperature_sensor_type";

interface MockMachine extends UAObject {
    temperatureSensor: UAVariable;
    heaterSwitch: UAVariable;
}

interface MockMachineType extends UAObjectType {
    temperatureSensor: UAVariable;
    heaterSwitch: UAVariable;

    instantiate(options: InstantiateObjectOptions): MockMachine;
}

function createMachineType(addressSpace: AddressSpace): MockMachineType {
    const namespace = addressSpace.getOwnNamespace();

    const temperatureSensorType = createTemperatureSensorType(addressSpace);

    // -------------------------------------------- MachineType
    const machineTypeNode = namespace.addObjectType({
        browseName: "MachineType"
    }) as MockMachineType;

    const machineTypeTemperatureSensorNode = temperatureSensorType.instantiate({
        browseName: "TemperatureSensor",
        componentOf: machineTypeNode,
        modellingRule: "Mandatory"
    });

    should.exist(machineTypeNode.temperatureSensor);
    machineTypeTemperatureSensorNode.modellingRule!.should.eql("Mandatory");

    // MachineType.HeaderSwitch
    const machineTypeHeaderSwitchNode = namespace.addVariable({
        browseName: "HeaterSwitch",
        dataType: "Boolean",
        modellingRule: "Mandatory",
        propertyOf: machineTypeNode,
        value: { dataType: DataType.Boolean, value: false }
    });

    should.exist(machineTypeNode.heaterSwitch);
    // xx console.log(machineTypeNode.heaterSwitch.nodeId.toString());
    // xx console.log(machineTypeNode.heaterSwitch.nodeId.toString());

    assert(machineTypeHeaderSwitchNode.browseName.toString() === "1:HeaterSwitch");
    return machineTypeNode;
}

// tslint:disable:no-empty-interface
interface SpecialTemperatureSensor extends TemperatureSensor {
    //
}

interface SpecialTemperatureSensorType extends TemperatureSensorType {
    instantiate(options: InstantiateObjectOptions): SpecialTemperatureSensor;
}

function createSpecialTempSensorType(addressSpace: AddressSpace): SpecialTemperatureSensorType {
    const namespace = addressSpace.getOwnNamespace();

    const temperatureSensorType = addressSpace.findObjectType("1:TemperatureSensorType")!;
    should.exist(temperatureSensorType);

    const specialTemperatureSensorTypeNode = namespace.addObjectType({
        browseName: "SpecialTemperatureSensorType",
        subtypeOf: temperatureSensorType
    }) as SpecialTemperatureSensorType;

    return specialTemperatureSensorTypeNode;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new ObjectType ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should create a new TemperatureSensorType", async () => {
        const machineTypeNode = createMachineType(addressSpace);

        // perform some verification on temperatureSensorType
        const temperatureSensorType = addressSpace.findObjectType(
            "TemperatureSensorType",
            namespace.index
        )! as TemperatureSensorType;

        should.exist(temperatureSensorType.temperature);

        const temperatureSensor = temperatureSensorType.instantiate({
            browseName: "Test",
            organizedBy: "RootFolder"
        });
        should.exist(temperatureSensor.temperature);

        // perform some verification
        const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType")!;
        temperatureSensor.temperature.typeDefinition.should.eql(baseDataVariableType.nodeId);

        const folder = namespace.addFolder("ObjectsFolder", { browseName: "MyDevices" });
        assert(folder.nodeId);

        const machine1 = machineTypeNode.instantiate({ organizedBy: folder, browseName: "Machine1" });

        should(machine1.temperatureSensor).be.instanceOf(Object);
        should(machine1.heaterSwitch).be.instanceOf(Object);

        // xx console.log(" Machine 1 = ", machine1.toString());

        const machine2 = machineTypeNode.instantiate({ organizedBy: folder, browseName: "Machine2" });

        const specialTemperatureSensorTypeNode = createSpecialTempSensorType(addressSpace);
        specialTemperatureSensorTypeNode.nodeClass.should.eql(NodeClass.ObjectType);

        specialTemperatureSensorTypeNode.subtypeOfObj!.browseName.toString().should.eql("1:TemperatureSensorType");

        const specialSensor = specialTemperatureSensorTypeNode.instantiate({
            browseName: "mySpecialSensor",
            organizedBy: "RootFolder"
        });

        specialSensor.should.have.property("typeDefinitionObj");
        // xx should.not.exist(specialSensor.subtypeOfObj);//, "Object should not have SubType");
        specialSensor.typeDefinitionObj.browseName.toString().should.eql("1:SpecialTemperatureSensorType");
        should.exist(specialSensor.temperature);
    });

    it("should create a new CameraType with Method", async () => {
        const cameraType = createCameraType(addressSpace);

        const camera1 = cameraType.instantiate({
            browseName: "Camera1",
            organizedBy: "RootFolder"
        });

        camera1.browseName.toString().should.eql("1:Camera1");

        // camera should have one component
        const c = camera1.getComponents();
        c.length.should.eql(1, " expecting camera1 to have 1 component => the Method");

        c[0].nodeClass.should.eql(NodeClass.Method);
        c[0].browseName.toString().should.eql("1:Trigger");

        cameraType.getComponents()[0].nodeClass.should.eql(NodeClass.Method);
        cameraType.getComponents()[0].nodeId.toString().should.not.eql(c[0].nodeId.toString());
        cameraType.getComponents()[0].browseName.toString().should.eql("1:Trigger");

        cameraType.getMethodByName("Trigger")!.nodeClass.should.eql(NodeClass.Method);
        camera1.getMethodByName("Trigger")!.nodeClass.should.eql(NodeClass.Method);

        camera1
            .getMethodByName("Trigger")!
            .methodDeclarationId.toString()
            .should.eql(cameraType.getMethodByName("Trigger")!.nodeId.toString());
    });
});

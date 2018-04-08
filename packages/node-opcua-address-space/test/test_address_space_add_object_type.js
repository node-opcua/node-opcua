"use strict";
/* global describe,it,before*/

const should = require("should");

const assert = require("node-opcua-assert").assert;

const UAObjectType = require("..").UAObjectType;
const UAMethod = require("..").UAMethod;

const DataType = require("node-opcua-variant").DataType;
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const createCameraType = require("./fixture_camera_type").createCameraType;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new ObjectType ", function () {

    let addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });

    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });

    const createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;


    function createMachineType(addressSpace) {

        const baseObjectType = addressSpace.findObjectType("BaseObjectType");
        const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");

        const temperatureSensorType = createTemperatureSensorType(addressSpace);

        // -------------------------------------------- MachineType
        const machineTypeNode = addressSpace.addObjectType({browseName: "MachineType"});

        const machineTypeTemperatureSensorNode = temperatureSensorType.instantiate({
            componentOf: machineTypeNode,
            modellingRule: "Mandatory",
            browseName: "TemperatureSensor"
        });
        should.exist(machineTypeNode.temperatureSensor);
        machineTypeTemperatureSensorNode.modellingRule.should.eql("Mandatory");

        // MachineType.HeaderSwitch
        const machineTypeHeaderSwitchNode = addressSpace.addVariable({
            propertyOf: machineTypeNode,
            modellingRule: "Mandatory",
            browseName: "HeaterSwitch",
            dataType: "Boolean",
            value: {dataType: DataType.Boolean, value: false}
        });

        should.exist(machineTypeNode.heaterSwitch);
        //xx console.log(machineTypeNode.heaterSwitch.nodeId.toString());
        //xx console.log(machineTypeNode.heaterSwitch.nodeId.toString());

        assert(machineTypeHeaderSwitchNode.browseName.toString() === "HeaterSwitch");
        return machineTypeNode;
    }


    it("should create a new TemperatureSensorType", function (done) {


        const machineTypeNode = createMachineType(addressSpace);

        // perform some verification on temperatureSensorType
        const temperatureSensorType = addressSpace.findObjectType("TemperatureSensorType");
        should.exist(temperatureSensorType.temperature);

        const temperatureSensor = temperatureSensorType.instantiate({organizedBy: "RootFolder", browseName: "Test"});
        should.exist(temperatureSensor.temperature);

        // perform some verification
        const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");
        temperatureSensor.temperature.typeDefinition.should.eql(baseDataVariableType.nodeId);


        const folder = addressSpace.addFolder("ObjectsFolder", {browseName: "MyDevices"});
        assert(folder.nodeId);

        const machine1 = machineTypeNode.instantiate({organizedBy: folder, browseName: "Machine1"});

        should(machine1.temperatureSensor).be.instanceOf(Object);
        should(machine1.heaterSwitch).be.instanceOf(Object);

        //xx console.log(" Machine 1 = ", machine1.toString());

        const machine2 = machineTypeNode.instantiate({organizedBy: folder, browseName: "Machine2"});


        function createSpecialTempSensorType(addressSpace) {

            const specialTemperatureSensorTypeNode = addressSpace.addObjectType({
                browseName: "SpecialTemperatureSensorType",
                subtypeOf: addressSpace.findObjectType("TemperatureSensorType")
            });
            return specialTemperatureSensorTypeNode;
        }

        const specialTemperatureSensorTypeNode = createSpecialTempSensorType(addressSpace);
        specialTemperatureSensorTypeNode.should.be.instanceOf(UAObjectType);

        //xx console.log(specialTemperatureSensorTypeNode);
        //xx console.log(specialTemperatureSensorTypeNode.toString());

        //xx specialTemperatureSensorTypeNode.should.not.have.property("typeDefinitionObj");
        should(specialTemperatureSensorTypeNode.typeDefinitionObj).eql(null, "ObjectType should not have TypeDefinition");
        specialTemperatureSensorTypeNode.subtypeOfObj.browseName.toString().should.eql("TemperatureSensorType");

        const specialSensor = specialTemperatureSensorTypeNode.instantiate({
            organizedBy: "RootFolder",
            browseName: "mySpecialSensor"
        });

        specialSensor.should.have.property("typeDefinitionObj");
        //xx should.not.exist(specialSensor.subtypeOfObj);//, "Object should not have SubType");
        specialSensor.typeDefinitionObj.browseName.toString().should.eql("SpecialTemperatureSensorType");
        should.exist(specialSensor.temperature);

        //xx console.log("done");
        done();

    });

    it("should create a new CameraType with Method", function (done) {

        const cameraType = createCameraType(addressSpace);

        const camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName: "Camera1"
        });

        camera1.browseName.toString().should.eql("Camera1");

        // camera should have one component
        const c = camera1.getComponents();
        c.length.should.eql(1, " expecting camera1 to have 1 component => the Method");

        c[0].should.be.instanceOf(UAMethod);
        c[0].browseName.toString().should.eql("1:Trigger");

        cameraType.getComponents()[0].should.be.instanceOf(UAMethod);

        cameraType.getComponents()[0].nodeId.toString().should.not.eql(c[0].nodeId.toString());
        //xx console.log(cameraType.getComponents()[0].nodeId.toString());
        //xx console.log(c[0].nodeId.toString());

        done();
    });


});

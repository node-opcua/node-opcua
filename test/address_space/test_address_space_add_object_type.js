"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");

var _ = require("underscore");
var assert = require("better-assert");
var path = require("path");

var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;

describe("testing add new ObjectType ", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                done(err);
            });

        });
        after(function () {
            addressSpace.dispose();
            addressSpace = null;
        });
    });

    var createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;


    function createMachineType(addressSpace) {

        var baseObjectType = addressSpace.findObjectType("BaseObjectType");
        var baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");

        var temperatureSensorType = createTemperatureSensorType(addressSpace);

        // -------------------------------------------- MachineType
        var machineTypeNode = addressSpace.addObjectType({browseName: "MachineType"});

        var machineTypeTemperatureSensorNode = temperatureSensorType.instantiate({
            componentOf:   machineTypeNode,
            modellingRule: "Mandatory",
            browseName:    "TemperatureSensor"
        });
        assert(machineTypeNode.temperatureSensor);
        machineTypeTemperatureSensorNode.modellingRule.should.eql("Mandatory");

        // MachineType.HeaderSwitch
        var machineTypeHeaderSwitchNode = addressSpace.addVariable({
            propertyOf: machineTypeNode,
            modellingRule: "Mandatory",
            browseName: "HeaterSwitch",
            dataType: "Boolean",
            value: {dataType: DataType.Boolean, value: false}
        });

        assert(machineTypeNode.heaterSwitch);
        //xx console.log(machineTypeNode.heaterSwitch.nodeId.toString());
        return machineTypeNode;
    }


    it("should create a new TemperatureSensorType", function (done) {


        var machineTypeNode = createMachineType(addressSpace);

        // perform some verification on temperatureSensorType
        var temperatureSensorType = addressSpace.findObjectType("TemperatureSensorType");
        should(temperatureSensorType.temperature).not.eql(0);

        var temperatureSensor = temperatureSensorType.instantiate({organizedBy: "RootFolder", browseName: "Test"});
        should(temperatureSensor.temperature).not.eql(0);

        // perform some verification
        var baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");
        temperatureSensor.temperature.typeDefinition.should.eql(baseDataVariableType.nodeId);


        var folder = addressSpace.addFolder("RootFolder", {browseName: "MyDevices"});
        assert(folder.nodeId);

        var machine1 = machineTypeNode.instantiate({organizedBy: folder, browseName: "Machine1"});

        should(machine1.temperatureSensor).be.instanceOf(Object);
        should(machine1.heaterSwitch).be.instanceOf(Object);

        //Xx console.log(" Machine 1 = ", machine1.toString());

        var machine2 = machineTypeNode.instantiate({organizedBy: folder, browseName: "Machine2"});


        function createSpecialTempSensorType(addressSpace) {

            var specialTemperatureSensorTypeNode = addressSpace.addObjectType({
                browseName: "SpecialTemperatureSensorType",
                subtypeOf: addressSpace.findObjectType("TemperatureSensorType")
            });
            return specialTemperatureSensorTypeNode;
        }

        var specialTemperatureSensorTypeNode = createSpecialTempSensorType(addressSpace);
        specialTemperatureSensorTypeNode.should.be.instanceOf(UAObjectType);

        //xx console.log(specialTemperatureSensorTypeNode);
        //xx console.log(specialTemperatureSensorTypeNode.toString());

        //xx specialTemperatureSensorTypeNode.should.not.have.property("typeDefinitionObj");
        should(specialTemperatureSensorTypeNode.typeDefinitionObj).eql(null, "ObjectType should not have TypeDefinition");
        specialTemperatureSensorTypeNode.subtypeOfObj.browseName.toString().should.eql("TemperatureSensorType");

        var specialSensor = specialTemperatureSensorTypeNode.instantiate({
            organizedBy: "RootFolder",
            browseName: "mySpecialSensor"
        });

        specialSensor.should.have.property("typeDefinitionObj");
        specialSensor.should.not.have.property("subtypeOfObj", "Object should not have SubType");
        specialSensor.typeDefinitionObj.browseName.toString().should.eql("SpecialTemperatureSensorType");
        should(specialSensor.temperature).not.eql(0);

        //xx console.log("done");
        done();

    });

    it("should create a new CameraType with Method", function (done) {

        var createCameraType = require("./fixture_camera_type").createCameraType;
        var cameraType = createCameraType(addressSpace);

        var camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName:  "Camera1"
        });

        camera1.browseName.toString().should.eql("Camera1");

        // camera should have one component
        var c = camera1.getComponents();
        c.length.should.eql(1," expecting camera1 to have 1 component => the Method");

        var UAMethod = require("lib/address_space/ua_method").UAMethod;
        c[0].should.be.instanceOf(UAMethod);
        c[0].browseName.toString().should.eql("1:Trigger");

        cameraType.getComponents()[0].should.be.instanceOf(UAMethod);

        cameraType.getComponents()[0].nodeId.toString().should.not.eql(c[0].nodeId.toString());
        //xx console.log(cameraType.getComponents()[0].nodeId.toString());
        //xx console.log(c[0].nodeId.toString());

        done();
    });

});

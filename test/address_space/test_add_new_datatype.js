"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");

describe("testing add new DataType ", function () {

    var address_space;
    before(function () {
        address_space = new AddressSpace();
    });

    function createTemperatureSensorType(address_space) {

        // TemperatureSensorType
        var temperatureSensorTypeNode = address_space.addObjectType({ browseName: "TemperatureSensorType" });

        address_space.addVariable(temperatureSensorTypeNode,{
            browseName:     "Temperature",
            dataType:       "Double",
            modellingRule:  "Mandatory",
            value: { dataType: DataType.Double, value: 19.5}
        });

        //temperatureSensorTypeNode.subTypeOf.should.eql(address_space.findVariableType("BaseObjectType").nodeId);
        console.log(temperatureSensorTypeNode);
        console.log(temperatureSensorTypeNode.subTypeOf);
        return temperatureSensorTypeNode;

    }


    function createMachineType(address_space) {

        var baseObjectType = address_space.findObjectType("BaseObjectType");
        var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");

        var temperatureSensorType = createTemperatureSensorType(address_space);

        // -------------------------------------------- MachineType
        var machineTypeNode = address_space.addObjectType({ browseName: "MachineType" });

        var machineTypeTemperatureSensorNode = temperatureSensorType.instantiate({
            componentOf: machineTypeNode,
            browseName: "TemperatureSensor"
        });
        assert(machineTypeNode.temperatureSensor);

        // MachineType.HeaderSwitch
        var machineTypeHeaderSwitchNode = address_space.addProperty(machineTypeNode,{
            browseName: "HeaterSwitch",
            dataType: "Boolean",
            hasTypeDefinition: baseDataVariableType,
            value: { dataType: DataType.Boolean, value: false}
        });
        //xx machineTypeHeaderSwitchNode.propagate_back_references(address_space);

        assert(machineTypeNode.heaterSwitch);
        console.log(machineTypeNode.heaterSwitch.nodeId.toString());
        return machineTypeNode;
    }


    function instantiateMachine(address_space,parentFolder,options) {
        assert(parentFolder.nodeId);
        assert(_.isString(options.browseName));
        var baseObjectType = address_space.findObjectType("BaseObjectType");
        var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");

        var machineType = address_space.findObjectType("MachineType");
        assert(machineType);
        var machine = machineType.instantiate({
            componentOf: parentFolder,
            browseName:  options.browseName
        });

        machine.temperatureSensor.nodeId.should.be.instanceof(NodeId);
        return machine;
    }

    it("should create a new TemperatureSensorType",function(done) {
        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            if(err) {return done(err);}

            var machineTypeNode  = createMachineType(address_space);

            // perform some verification on temperatureSensorType
            var temperatureSensorType = address_space.findObjectType("TemperatureSensorType");
            should(temperatureSensorType.temperature).not.eql(0);

            var temperatureSensor = temperatureSensorType.instantiate({ organizedBy: "RootFolder", browseName: "Test"});
            should(temperatureSensor.temperature).not.eql(0);

            // perform some verification
            var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");
            temperatureSensor.temperature.hasTypeDefinition.should.eql(baseDataVariableType.nodeId);


            var folder =address_space.addFolder("RootFolder",{ browseName: "MyDevices"});
            assert(folder.nodeId);

            var machine1 = machineTypeNode.instantiate({organizedBy: folder,browseName: "Machine1"});

            should(machine1.temperatureSensor).be.instanceOf(Object);
            should(machine1.heaterSwitch).be.instanceOf(Object);

            console.log(" Machine 1 = ",machine1.toString());

            var machine2 = machineTypeNode.instantiate({organizedBy: folder,browseName: "Machine2"});


            function createSpecialTempSensorType(address_space) {

                var specialTemperatureSensorTypeNode = address_space.addObjectType({
                    browseName: "SpecialTemperatureSensorType",
                    subtypeOf: "TemperatureSensorType"
                });
                return specialTemperatureSensorTypeNode;
            }

            var specialTemperatureSensorTypeNode = createSpecialTempSensorType(address_space);
            specialTemperatureSensorTypeNode.should.be.instanceOf(UAObjectType);

            //xx console.log(specialTemperatureSensorTypeNode);
            //xx console.log(specialTemperatureSensorTypeNode.toString());

            //xx specialTemperatureSensorTypeNode.should.not.have.property("typeDefinitionObj");
            should(specialTemperatureSensorTypeNode.typeDefinitionObj).eql(null,"ObjectType should not have TypeDefinition");
            specialTemperatureSensorTypeNode.subtypeOfObj.browseName.should.eql("TemperatureSensorType");

            var specialSensor= specialTemperatureSensorTypeNode.instantiate({
                organizedBy:"RootFolder",
                browseName:"mySpecialSensor"
            });

            specialSensor.should.have.property("typeDefinitionObj");
            specialSensor.should.not.have.property("subtypeOfObj","Object should not have SubType");
            specialSensor.typeDefinitionObj.browseName.should.eql("SpecialTemperatureSensorType");
            should(specialSensor.temperature).not.eql(0);

            console.log("done");
            done();

        });
    });



});

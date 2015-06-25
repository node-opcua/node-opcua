"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
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

        var baseObjectType = address_space.findObjectType("BaseObjectType");
        var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");

        // TemperatureSensorType
        var temperatureSensorTypeParams = {
            nodeClass:   NodeClass.ObjectType,
            isAbstract:  false,
            nodeId: address_space._build_new_NodeId(),
            browseName: "TemperatureSensorType",
            eventNotifier: 0,
            references: [
                { referenceType: "HasSubtype", isForward: false, nodeId:  baseObjectType.nodeId }
            ]
        };
        var temperatureSensorTypeNode = address_space._createObject(temperatureSensorTypeParams);
        temperatureSensorTypeNode.propagate_back_references(address_space);

        var property1 = address_space.addProperty(temperatureSensorTypeNode,{
            browseName: "Temperature",
            dataType: "Double",
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId: baseDataVariableType.nodeId },
                { referenceType: "HasModelingRule" ,                    nodeId: "ModellingRule_Mandatory"   }
            ],
            value: { dataType: DataType.Double, value: 19.5}
        });
        //xx p.propagate_back_references(address_space);

        return temperatureSensorTypeNode;

    }

    function instantiateTemperatureSensor(address_space,parentObject,options) {

        assert(parentObject.nodeId);
        var temperatureSensorTypeNode = address_space.findObjectType("TemperatureSensorType");
        assert(temperatureSensorTypeNode.nodeId);

        assert(_.isString(options.browseName),"expecting a browse name");

        var temperatureSensorNode = address_space._createObject({
            browseName:  options.browseName,
            nodeId:      address_space._build_new_NodeId(),
            nodeClass:   NodeClass.Object,
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId:  temperatureSensorTypeNode.nodeId },
                { referenceType: "HasComponent",      isForward: false, nodeId: parentObject.nodeId}
            ]
        });
        temperatureSensorNode.propagate_back_references(address_space);

        address_space.addProperty(temperatureSensorNode,{
            browseName: "Temperature",
            dataType: "Double",
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId: "BaseDataVariableType" },
            ],
            value: { dataType: DataType.Double, value: 19.5}
        });
    }

    function createMachineType(address_space) {

        var baseObjectType = address_space.findObjectType("BaseObjectType");
        var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");

        var temperatureSensorTypeNode = createTemperatureSensorType(address_space);

        // -------------------------------------------- MachineType
        var machineTypeParams = {
            nodeClass:   NodeClass.ObjectType,
            isAbstract:  false,
            nodeId: address_space._build_new_NodeId(),
            browseName: "MachineType",
            eventNotifier: 0,
            references: [
                { referenceType: "HasSubtype", isForward: false, nodeId:  baseObjectType.nodeId }
            ]
        };
        var machineTypeNode = address_space._createObject(machineTypeParams);
        machineTypeNode.propagate_back_references(address_space);
        assert(machineTypeNode.nodeId);
        // MachineType.TemperatureSensor
        var machineTypeTemperatureSensorNode = instantiateTemperatureSensor(address_space,machineTypeNode,{
            browseName: "TemperatureSensor"
        });

        // MachineType.HeaderSwitch
        var machineTypeHeaderSwitchNode = address_space.addProperty(machineTypeNode,{
            browseName: "HeaterSwitch",
            dataType: "Boolean",
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId: baseDataVariableType.nodeId },
                //xx { referenceType: "HasProperty",       isForward: false, nodeId: machineTypeNode.nodeId}
            ],
            value: { dataType: DataType.Boolean, value: false}
        });
        machineTypeHeaderSwitchNode.propagate_back_references(address_space);

        return machineTypeNode;
    }


    function instantiateMachine(address_space,parentFolder,options) {

        assert(parentFolder.nodeId);
        assert(_.isString(options.browseName));
        var baseObjectType = address_space.findObjectType("BaseObjectType");
        var baseDataVariableType = address_space.findVariableType("BaseDataVariableType");

        // -------------------------------------------- MachineType
        var machineType = address_space.findObjectType("MachineType");
        assert(machineType);

        // create machine type object
        var machineParams = {
            nodeClass:   NodeClass.Object,
            nodeId: address_space._build_new_NodeId(),
            browseName: options.browseName,
            eventNotifier: 0,
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId:  machineType.nodeId },
                { referenceType: "HasComponent", isForward: false, nodeId:  parentFolder.nodeId },
            ]
        };
        var myMachineNode = address_space._createObject(machineParams);

        // MachineType.TemperatureSensor
        var machineTypeTemperatureSensorNode = instantiateTemperatureSensor(address_space,myMachineNode,{
            browseName: "TemperatureSensor"
        });

        // MachineType.HeaderSwitch
        var machineHeaterSwitchNode = address_space.addProperty(myMachineNode,{
            browseName: "HeaterSwitch",
            dataType: "Boolean",
            references: [
                { referenceType: "HasTypeDefinition", isForward: false, nodeId: baseDataVariableType.nodeId },
                //xx { referenceType: "HasProperty",       isForward: false, nodeId: machineTypeNode.nodeId}
            ],
            value: { dataType: DataType.Boolean, value: false}
        });
        machineHeaterSwitchNode.propagate_back_references(address_space);

        return myMachineNode;
    }
    it("should create a new TemperatureSensorType",function(done) {
        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            if(err) {return done(err);}

            var machineTypeNode  = createMachineType(address_space);

            var folder =address_space.addFolder("RootFolder",{ browseName: "MyDevices"});
            assert(folder.nodeId);

            var machine1 = instantiateMachine(address_space,folder,{ browseName: "Machine1"});
            var machine2 = instantiateMachine(address_space,folder,{ browseName: "Machine2"});
            var machine3 = instantiateMachine(address_space,folder,{ browseName: "Machine3"});
            var machine4 = instantiateMachine(address_space,folder,{ browseName: "Machine4"});
            console.log("done");
            done();

        });
    });
});
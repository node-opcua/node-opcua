var NodeClass = require("./../datamodel/nodeclass").NodeClass;

var NodeId = require("../datamodel/nodeid").NodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var makeNodeId = require("../datamodel/nodeid").makeNodeId;
var NodeIdType = require("../datamodel/nodeid").NodeIdType;

var address_space = require("../address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var ServerEngine = require("../server/server_engine").ServerEngine;

var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var VariantArrayType  = require("../datamodel/variant").VariantArrayType;
var assert_valid_variant = require("../datamodel/variant").assert_valid_variant;

var assert = require("better-assert");


var factories = require("../misc/factories");

var DataType =require("../datamodel/variant").DataType;

var namespaceIndex = 411;

function add_var(server_engine,parent,dataTypeName,defaultValue) {


    assert(server_engine.address_space instanceof AddressSpace);
    var name = parent.browseName + "_" + dataTypeName;
    var value = defaultValue;

    var builtInDataTypeName = factories.findBuiltInType(dataTypeName);
    var dataType = DataType[builtInDataTypeName.name];
    assert(dataType !== undefined && " dataType must exists");

    var nodeId = makeNodeId(name,namespaceIndex);

    var variable = server_engine.addVariable(parent,{
        browseName: name,
        description: { locale: "en" , text: name},
        nodeId: nodeId,
        dataType: dataTypeName,
        value: {
            // expect a Variant
            get: function(){
                return new Variant({
                    dataType: dataType,
                    arrayType: VariantArrayType.Scalar,
                    value: value
                });
            },
            set: function(variant){
                // at this time we only accept exact dateType
                // no conversion will take place here
                // todo: add a clever value coersion
                assert(variant.dataType === dataType);
                value = variant.value;
            }
        }
    });

    var obj = server_engine.findObject(nodeId);

    return variable;
};

/**
 * @method build_address_space_for_conformance_testing
 * @param server_engine {ServerEngine}
 */
var build_address_space_for_conformance_testing;
build_address_space_for_conformance_testing = function (server_engine) {


    assert(server_engine instanceof ServerEngine);
    assert(server_engine.address_space instanceof AddressSpace);

    var objectsFolder = server_engine.findObject('ObjectsFolder');

    var scalarFolder = server_engine.createFolder(objectsFolder, {
        browseName: "Scalar",
        description: "Simply a parent folder"
    });

    var simulation = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Simulation",
        description: "This folder will contain one item per supported data-type.",
        nodeId: makeNodeId(4000, namespaceIndex)
    });

    var DateTime_Min = new Date();

    add_var(server_engine, simulation, "Boolean", false);
    add_var(server_engine, simulation, "Byte", 0);
    add_var(server_engine, simulation, "ByteString", "OPCUA");
    add_var(server_engine, simulation, "DateTime", DateTime_Min);
    add_var(server_engine, simulation, "Double", 0.0);
    add_var(server_engine, simulation, "Duration", 0.0);
    add_var(server_engine, simulation, "Float", 0.0);
//xx    add_var(server_engine, simulation, "Guid", "");
//xx    add_var(server_engine, simulation, "Guid", "");
    add_var(server_engine, simulation, "Int16", 0);
    add_var(server_engine, simulation, "Int32", 0);
//xx    add_var(server_engine, simulation, "Int64", 0);
//xx    add_var(server_engine, simulation, "Integer", 0);
//xx    add_var(server_engine, simulation, "LocaleId", 0);
//xx    add_var(server_engine, simulation, "LocalizedText", 0);
    add_var(server_engine, simulation, "NodeId", makeNodeId("ns=" + namespaceIndex + ";g={00000000-0000-0000-0000-0000-00000023}"));
//    add_var(server_engine, simulation, "Number", 0);
//    add_var(server_engine, simulation, "QualifiedName", 0);
//    add_var(server_engine, simulation, "SByte", 0);
    add_var(server_engine, simulation, "String", "OPCUA");
//    add_var(server_engine, simulation, "Time", "00:00:00");
    add_var(server_engine, simulation, "UInt16", 0);
    add_var(server_engine, simulation, "UInt32", 0);
//    add_var(server_engine, simulation, "UInt64", 0);
    add_var(server_engine, simulation, "UInteger", 0);
    add_var(server_engine, simulation, "UtcTime", 0);
//    add_var(server_engine, simulation, "Variant", 0);
//    add_var(server_engine, simulation, "XmlElement", "<string1>OPCUA</string1>");

    // add_var(address_space,simulation,"Interval", "The rate (in msec) of change for all Simulated items.",100);
    // add_var(address_space,simulation,"Enabled", true);


};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;
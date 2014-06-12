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
var _ = require("underscore");

var assert = require("better-assert");


var factories = require("../misc/factories");

var DataType =require("../datamodel/variant").DataType;

var namespaceIndex = 411;

var value_to_change = [];

var ec = require("../misc/encode_decode");


function change_randomly() {
    value_to_change.forEach(function(element){
        assert( element.hasOwnProperty("dataType"));
        var variable = element.variable;
        var dataType = element.dataType;
        element.value = ec["random"+dataType]();
        //xx console.log( variable.browseName , " set to ", element.value);
    });

}
function add_var(server_engine,parent,dataTypeName,defaultValue) {

    assert(server_engine.address_space instanceof AddressSpace);
    var name = parent.browseName + "_" + dataTypeName;


    var builtInDataTypeName = factories.findBuiltInType(dataTypeName);
    var dataType = DataType[builtInDataTypeName.name];
    assert(dataType !== undefined && " dataType must exists");

    var nodeId = makeNodeId(name,namespaceIndex);

    var validFunc = ec["isValid"+dataType];
    assert(_.isFunction(validFunc));
    assert(validFunc(defaultValue));
    var randomFunc = ec["random"+dataType];
    assert(_.isFunction(randomFunc));

    var obj = {
        value: defaultValue
    };

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
                    value: obj.value
                });
            },
            set: function(variant){
                // at this time we only accept exact dateType
                // no conversion will take place here
                // todo: add a clever value coersion
                assert(variant.dataType === dataType);
                obj.value = variant.value;
            }
        }
    });

    obj.variable = variable;
    obj.dataType = dataType;
    value_to_change.push(obj);

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

    add_var(server_engine, simulation, "Boolean",    false);
    add_var(server_engine, simulation, "ByteString", new Buffer("OPCUA"));
    add_var(server_engine, simulation, "DateTime",   DateTime_Min);
    add_var(server_engine, simulation, "Double",     0.0);
    add_var(server_engine, simulation, "Duration",   0.0);
    add_var(server_engine, simulation, "Float",      0.0);
    add_var(server_engine, simulation, "Guid",       ec.emptyGuid);
    add_var(server_engine, simulation, "SByte",      0);
    add_var(server_engine, simulation, "Int16",      0);
    add_var(server_engine, simulation, "Int32",      0);
    add_var(server_engine, simulation, "Integer",    0);
    add_var(server_engine, simulation, "NodeId",     makeNodeId("ns=" + namespaceIndex + ";g={00000000-0000-0000-0000-0000-00000023}"));
    add_var(server_engine, simulation, "String",     "OPCUA");
    add_var(server_engine, simulation, "Byte",       0);
    add_var(server_engine, simulation, "UInt16",     0);
    add_var(server_engine, simulation, "UInt32",     0);
    add_var(server_engine, simulation, "UInteger",   0);
    add_var(server_engine, simulation, "UtcTime",    new Date());
    //xx    add_var(server_engine, simulation, "Int64", 0);
    //xx    add_var(server_engine, simulation, "LocaleId", 0);
    //xx    add_var(server_engine, simulation, "LocalizedText", 0);
    //    add_var(server_engine, simulation, "Number", 0);
    //    add_var(server_engine, simulation, "QualifiedName", 0);
    //    add_var(server_engine, simulation, "Time", "00:00:00");
    //    add_var(server_engine, simulation, "UInt64", 0);
    //    add_var(server_engine, simulation, "Variant", 0);
    //    add_var(server_engine, simulation, "XmlElement", "<string1>OPCUA</string1>");


    var interval = 200;
    var enabled = true;
    var timer;
    function install_Timer() {
        // delete previous timer if any
        if (timer) { clearInterval(timer); timer = null;}
        if (enabled) {
            timer = setInterval(function() {
                change_randomly();
            },interval);
        };
    };

    // var name = "Interval", "UInt16"
    server_engine.addVariable(simulation,{
        browseName: "Interval",
        description: { locale: "en" , text: "The rate (in msec) of change for all Simulated items."},
        nodeId: makeNodeId("Interval",namespaceIndex),
        dataType: "UInt16",
        value: {
            // expect a Variant
            get: function(){
                return new Variant({
                    dataType: DataType.UInt16,
                    arrayType: VariantArrayType.Scalar,
                    value: interval
                });
            },
            set: function(variant){
                interval = variant.value;
                install_Timer();
            }
        }
    });


    server_engine.addVariable(simulation,{
        browseName: "Enabled",
        description: { locale: "en" , text: "Enabled"},
        nodeId: makeNodeId("Enabled",namespaceIndex),
        dataType: "Boolean",
        value: {
            // expect a Variant
            get: function(){
                return new Variant({
                    dataType: DataType.Boolean,
                    arrayType: VariantArrayType.Scalar,
                    value: enabled
                });
            },
            set: function(variant){
                enabled = variant.value;
                install_Timer();
            }
        }
    });
    install_Timer();

};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;
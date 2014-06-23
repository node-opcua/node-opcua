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
var LocalizedText = require("../datamodel/structures").LocalizedText;
var QualifiedName = require("../datamodel/structures").QualifiedName;

var makeAccessLevel = require("../datamodel/access_level").makeAccessLevel;

function getValidatorFuncForType(dataType) {
    var f = ec["isValid"+dataType];
    if (f) return f;
    return function(value){return true;};
}
function getRandomFuncForType(dataType) {
    dataType = dataType.key;
    var f =     ec["random"+dataType];
    if (f) return f;
    console.log("dataType  ",dataType);
    switch(dataType) {
        case "Variant":
            return function()  {
                return new Variant();
            }
            break;
        case "QualifiedName":
           return function() {
               return new QualifiedName({
                   name: ec.randomString()
               });
           }
           break;
        case "LocalizedText":
            return function() {
                return new LocalizedText({
                    text: ec.randomString()
                });
            }
            break;
        case "XmlElement" :
            return function() {
                var element = ec.randomString();
                var content =  ec.randomString();
                return "<" + element + ">"+ content + "</" + element + ">"
            }
        default:
            throw Error("Cannot find random"+dataType+"() func anywhere");
    }
    return null;
}

function change_randomly() {

    value_to_change.forEach(function(element){
        assert( element.hasOwnProperty("dataType"));
        var variable = element.variable;
        var dataType = element.dataType;
        element.current_value = element.randomFunc(); //
        //xx console.log( variable.browseName , " set to ", element.value);
    });

}


function _findDataType(dataTypeName) {
    var builtInDataTypeName = factories.findBuiltInType(dataTypeName);
    var dataType = DataType[builtInDataTypeName.name];
    if (!dataType) {
        throw new Error(" dataType "+ dataTypeName + " must exists");
    }
    return dataType;
}

function _add_variable(server_engine,parent,dataTypeName,placeholder,isArray,extra_name) {

    assert(typeof(extra_name) === "string");

    isArray = ( isArray === null) ? false: isArray;

    var arrayType = VariantArrayType.Scalar;
    if (isArray) {
        arrayType = VariantArrayType.Array;
    }
    assert(placeholder.current_value !== null);
    assert(server_engine.address_space instanceof AddressSpace);
    var name = parent.browseName + "_" + dataTypeName + extra_name;

///xx    console.log("xxxxx",name);

    var nodeId = makeNodeId(name,namespaceIndex);

    var dataType = _findDataType(dataTypeName);

    var validFunc = getValidatorFuncForType(dataType);
    assert(_.isFunction(validFunc));

    if (isArray) {
        placeholder.current_value.forEach(function(value,elementIndex){
            if (!validFunc(value)) {
                throw new Error("default value must be valid for dataType " + dataTypeName + " "+placeholder.current_value + " at index " + elementIndex );
            }
        })
    } else {
        // scalar
        if (!validFunc(placeholder.current_value)) {
            throw new Error("default value must be valid for dataType " + dataTypeName + " "+placeholder.current_value );
        }
    }

    var variable = server_engine.addVariable(parent,{
        browseName: name,
        description: { locale: "en" , text: name},
        nodeId: nodeId,
        dataType: dataTypeName,
        valueRank: -1,
        value: {
            // expect a Variant
            get: function(){
                return new Variant({
                    dataType: dataType,
                    arrayType: arrayType,
                    value: placeholder.current_value
                });
            },
            set: function(variant){
                // at this time we only accept exact dateType
                // no conversion will take place here
                // todo: add a clever value coersion
                assert(variant.dataType === dataType);
                assert(validFunc( variant.value) && " value must be valid for dataType");
                placeholder.value = variant.value;
            }
        }
    });
    assert(server_engine.findObject(nodeId));
    return variable;
}

function add_variable(server_engine,parent,dataTypeName,default_value,extra_name) {

    assert(typeof(extra_name) === "string");

    var local_defaultValue =_.isFunction(default_value) ? default_value() : default_value;
    var place_holder = {
        current_value: local_defaultValue
    };
    var variable =  _add_variable(server_engine,parent,dataTypeName,place_holder,false,extra_name);
    assert(variable.valueRank       === -1);
    //xx console.log("xxxxxx" ,variable.accessLevel.key)
    assert(variable.accessLevel.key   === "CurrentRead | CurrentWrite" );
    assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite" );
    assert(variable.historizing     === false );

    return variable;
}

function add_variable_array(server_engine,parent,dataTypeName,default_value) {

    var place_holder = {
        current_value :[]
    };
    for( var i=0;i<10;i++) {
        var local_defaultValue =_.isFunction(default_value) ? default_value() : default_value;
        place_holder.current_value.push(local_defaultValue);
    }
    _add_variable(server_engine,parent,dataTypeName,place_holder,true,"");
}

function add_mass_variables(server_engine,parent,dataTypeName,default_value) {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
    var nodeName =  "Scalar_Mass_" +dataTypeName;
    var scalarMass_Type = server_engine.addObjectInFolder(parent, {
        browseName:  nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId(nodeName, namespaceIndex)
    });
    for (var i=0;i<99;i++) {
        var extra_name = "_"+("00" + i.toString()).substr(-2);
        var local_defaultValue =_.isFunction(default_value) ? default_value() : default_value;
        var place_holder = {
            current_value :local_defaultValue
        };
        _add_variable(server_engine,scalarMass_Type,dataTypeName,place_holder,false,extra_name);
    }

}
/**
 *
 * @param server_engine
 * @param parent
 * @param dataTypeName
 * @param defaultValue
 * @returns {Variable}
 */
function add_simulation_variable(server_engine,parent,dataTypeName,defaultValue) {

    var dataType = _findDataType(dataTypeName);

    var randomFunc =getRandomFuncForType(dataType);
    if (!_.isFunction(randomFunc)) { throw new Error("a random function must exist for basicType " + dataTypeName);}

    var placeholder = {
        current_value: defaultValue,
        dataType: dataType
    };

    placeholder.variable = _add_variable(server_engine,parent,dataTypeName,placeholder,false,"");
    placeholder.randomFunc = randomFunc;
    value_to_change.push(placeholder);

    return placeholder.variable;
}

/**
 * @method build_address_space_for_conformance_testing
 * @param server_engine {ServerEngine}
 * @param options
 * @param options.mass_variable {Boolean}
 */
var build_address_space_for_conformance_testing;



build_address_space_for_conformance_testing = function (server_engine,options) {


    options = options || {};
    options.mass_variable = options.mass_variable || false;


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
        nodeId: makeNodeId("Scalar_Simulation", namespaceIndex)
    });

    var scalarStatic = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Static",
        description: "This folder will contain one item per supported data-type.",
        nodeId: makeNodeId("Scalar_Static", namespaceIndex)
    });
    var scalarStaticArray = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Static_Array",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: makeNodeId("Scalar_Static_Array", namespaceIndex)
    });

    var accessRight_Folder = server_engine.addObjectInFolder(objectsFolder, {
        browseName: "AccessRight",
        description: "Various node with differente access right behavior",
        nodeId: makeNodeId("AccessRight", namespaceIndex)
    });
    var accessLevel_All_Folder = server_engine.addObjectInFolder(accessRight_Folder, {
        browseName: "AccessLevel",
        description: "Various node with different access right behavior",
        nodeId: makeNodeId("AccessLevel", namespaceIndex)
    });

    var name ="AccessLevel_CurrentRead_NotCurrentWrite";
    var variable = server_engine.addVariable(accessLevel_All_Folder,{
        browseName: name,
        description: { locale: "en" , text: name},
        nodeId: makeNodeId(name,namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentRead | CurrentWrite",

        userAccessLevel: "CurrentRead",

        value: {
            // expect a Variant
            get: function(){
                return new Variant({
                    dataType: DataType.Int32,
                    arrayType: VariantArrayType.Scalar,
                    value: 36
                });
            },
            set:  null
        }
    });




    var DateTime_Min = new Date();

    var typeAndDefaultValue = [
        {  type: "Boolean" ,      defaultValue:  false },
        {  type: "ByteString" ,   defaultValue:  new Buffer("OPCUA") },
        {  type: "DateTime" ,     defaultValue:  DateTime_Min },
        {  type: "Double" ,       defaultValue:  0.0 },
        {  type: "Duration" ,     defaultValue:  0.0 },
        {  type: "Float" ,        defaultValue:  0.0 },
        {  type: "Guid" ,         defaultValue:  ec.emptyGuid },
        {  type: "SByte" ,        defaultValue:  0 },
        {  type: "Int16" ,        defaultValue:  0 },
        {  type: "Int32" ,        defaultValue:  0 },
        {  type: "Integer" ,      defaultValue:  0 },
        {  type: "NodeId",        defaultValue:  function(){ return makeNodeId("ns=" + namespaceIndex + ";g={00000000-0000-0000-0000-0000-00000023}") }},
        {  type: "String",        defaultValue:  "OPCUA"},
        {  type: "Byte",          defaultValue:  0},
        {  type: "UInt16",        defaultValue:  0},
        {  type: "UInt32",        defaultValue:  0},
        {  type: "UInteger",      defaultValue:  0},
        {  type: "UtcTime",       defaultValue:  function(){ return new Date(); }},
//xx        {  type: "Int64",         defaultValue:  0},
        {  type: "LocaleId",      defaultValue:  ""},
        {  type: "LocalizedText", defaultValue:  function(){ return new LocalizedText({}); }},
        {  type: "Number",        defaultValue:  0},
        {  type: "QualifiedName", defaultValue:  function(){  return new QualifiedName();}},
        {  type: "Time",          defaultValue:  "00:00:00"},
//xx       {  type: "UInt64",        defaultValue:   0},
//xx    {  type: "Variant",       defaultValue:  function() { return new Variant(); }},
        {  type: "XmlElement",    defaultValue:  "<string1>OPCUA</string1>"},
    ];

    // add statics
    typeAndDefaultValue.forEach(function(e) {
        var dataType = e.type;
        var defaultValue =_.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_variable(server_engine,scalarStatic,dataType,defaultValue,"");
    });

    // add static Array
    typeAndDefaultValue.forEach(function(e) {
        var dataType = e.type;
        add_variable_array(server_engine,scalarStaticArray,dataType, e.defaultValue);
    });
    // add static Mass

    var scalarMass = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId("Scalar_Mass", namespaceIndex)
    });

    if (options.mass_variables) {
        typeAndDefaultValue.forEach(function(e) {
            var dataType = e.type;
            add_mass_variables(server_engine,scalarMass,dataType, e.defaultValue);
        });

    }
    // add simulation variables
    typeAndDefaultValue.forEach(function(e){
        var dataType = e.type;
        var defaultValue =_.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_simulation_variable(server_engine, simulation,dataType, defaultValue);
    });



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
        }
    }

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
                assert( variant instanceof Variant);
                assert(ec.isValidUInt16(variant.value) && " value must be valid for dataType");
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
                assert( variant instanceof Variant);
                assert(ec.isValidBoolean(variant.value) && " value must be valid for dataType");
                enabled = variant.value;
                install_Timer();
            }
        }
    });
    install_Timer();

};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;
"use strict";
/**
 * @module opcua.server.simulation
 * @type {async|exports}
 * @class Simulator
 *
 */
require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");


var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var ServerEngine = require("lib/server/server_engine").ServerEngine;

var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var buildVariantArray = require("lib/datamodel/variant_tools").buildVariantArray;

var findBuiltInType = require("lib/misc/factories_builtin_types").findBuiltInType;
var DataValue = require("lib/datamodel/datavalue").DataValue;

var namespaceIndex = 411;

var ec = require("lib/misc/encode_decode");
var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

function defaultValidator(/*value*/) {
    return true;
}
function getValidatorFuncForType(dataType) {
    var f = ec["isValid" + dataType];
    return f || defaultValidator;
}
function getRandomFuncForType(dataType) {

    assert(dataType);
    dataType = dataType.key;

    var f = ec["random" + dataType];

    if (f) {
        return f;
    }

    //xx console.log("xxxx dataType  ",dataType);
    switch (dataType) {
        case "Variant":
            return function () {
                return new Variant();
            };
        case "QualifiedName":
            return function () {
                return new QualifiedName({name: ec.randomString()});
            };
        case "LocalizedText":
            return function () {
                return new LocalizedText({text: ec.randomString()});
            };
        case "XmlElement" :
            return function () {
                var element = ec.randomString();
                var content = ec.randomString();
                return "<" + element + ">" + content + "</" + element + ">";
            };
        default:
            throw new Error("Cannot find random" + dataType + "() func anywhere");
    }
}


function _findDataType(dataTypeName) {
    var builtInDataTypeName = findBuiltInType(dataTypeName);
    var dataType = DataType[builtInDataTypeName.name];
    if (!dataType) {
        throw new Error(" dataType " + dataTypeName + " must exists");
    }
    return dataType;
}

function validate_value_or_array(isArray, variantValue, validatorFunc) {

    assert(_.isFunction(validatorFunc));
    var i, value;
    if (isArray) {

        var n = Math.min(10, variantValue.length);

        for (i = 0; i < n; i++) {
            value = variantValue[i];
            if (!validatorFunc(value)) {
                throw new Error("default value must be valid for dataType " + dataTypeName + " " + variantValue + " at index " + i + " got " + value);
            }
        }

    } else {
        // scalar
        if (!validatorFunc(variantValue)) {
            throw new Error("default value must be valid for dataType " + dataTypeName + " " + variantValue);
        }
    }

}

function makeVariant(dataTypeName, isArray, current_value) {

    isArray = ( isArray === null) ? false : isArray;
    var arrayType = VariantArrayType.Scalar;
    if (isArray) {
        arrayType = VariantArrayType.Array;
    }
    var dataType = _findDataType(dataTypeName);
    assert(!dataType.isAbstract);

    var validatorFunc = getValidatorFuncForType(dataType);

    validate_value_or_array(isArray, current_value, validatorFunc);

    var variant = new Variant({
        dataType: dataType,
        arrayType: arrayType,
        value: current_value
    });
    return variant;
}

function _add_variable(server_engine, parent, varName, dataTypeName, current_value, isArray, extra_name) {

    assert(typeof(extra_name) === "string");
    assert(server_engine.address_space instanceof AddressSpace);

    var variant = makeVariant(dataTypeName, isArray, current_value);

    var name = parent.browseName + "_" + varName + extra_name;

    var nodeId = makeNodeId(name, namespaceIndex);

    var placeholder = {
        variant: variant
    };

    var variable = server_engine.addVariable(parent, {
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: nodeId,
        dataType: varName,
        valueRank: isArray ? 1 : -1,
        value: variant
    });
    variable._backdoor_placeholder = placeholder;
    assert(server_engine.findObject(nodeId));
    return variable;
}


function add_variable(server_engine, parent, name, realType, default_value, extra_name) {

    assert(typeof(extra_name) === "string");
    var initialValue = _.isFunction(default_value) ? default_value() : default_value;
    var variable = _add_variable(server_engine, parent, name, realType, initialValue, false, extra_name);
    assert(variable.valueRank === -1);
    assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.historizing === false);
    return variable;
}

function add_variable_array(server_engine, parent, dataTypeName, default_value, realTypeName, arrayLength,extra_name) {

    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");
    if (!DataType[realTypeName]) {
        console.log("dataTypeName", dataTypeName);
        console.log("realTypeName", realTypeName);
    }
    assert(DataType[realTypeName], " expecting a valid real type");
    arrayLength = arrayLength || 10;

    var local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;

    var current_value = buildVariantArray(DataType[realTypeName], arrayLength, local_defaultValue);

    var variable = _add_variable(server_engine, parent, dataTypeName, realTypeName, current_value, true, extra_name);

    assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.historizing === false);

}


function add_mass_variables_of_type(server_engine, parent, dataTypeName, default_value, realType) {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
    var nodeName = "Scalar_Mass_" + dataTypeName;

    console.log(" adding mass variable ", nodeName);
    var scalarMass_Type = server_engine.addObjectInFolder(parent, {
        browseName: nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId(nodeName, namespaceIndex)
    });
    for (var i = 0; i <= 99; i++) {
        var extra_name = "_" + ("00" + i.toString()).substr(-2);
        var local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;
        _add_variable(server_engine, scalarMass_Type, dataTypeName, realType, local_defaultValue, false, extra_name);
    }

}
function add_mass_variables(server_engine, scalarFolder) {

    var scalarMass = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId("Scalar_Mass", namespaceIndex)
    });

    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_mass_variables_of_type(server_engine, scalarMass, dataType, e.defaultValue, realType);
    });
}

/**
 * @method build_address_space_for_conformance_testing
 * @param server_engine {ServerEngine}
 * @param options
 * @param options.mass_variable {Boolean}
 */
var build_address_space_for_conformance_testing;


var DateTime_Min = new Date();

var typeAndDefaultValue = [
    {type: "Boolean", defaultValue: false},
    {type: "ByteString", defaultValue: new Buffer("OPCUA")},
    {type: "DateTime", defaultValue: DateTime_Min},
    {type: "Double", defaultValue: 0.0},
    {type: "Float", defaultValue: 0.0},
    {type: "Guid", defaultValue: ec.emptyGuid},
    {type: "SByte", defaultValue: 0},
    {type: "Int16", defaultValue: 0},
    {type: "Int32", defaultValue: 0},
    {
        type: "NodeId", defaultValue: function () {
        return coerceNodeId("ns=" + namespaceIndex + ";g=00000000-0000-0000-0000-000000000023");
    }
    },
    {type: "String", defaultValue: "OPCUA"},
    {type: "Byte", defaultValue: 0},
    {type: "UInt16", defaultValue: 0},
    {type: "UInt32", defaultValue: 0},
    {type: "Duration", realType: "Double", defaultValue: 0.0},
    {type: "Number", realType: "UInt16", defaultValue: 0},// Number is abstract
    {type: "Integer", realType: "Int64", defaultValue: 0},// because Integer is abstract , we choose Int32
    {type: "UInteger", realType: "UInt64", defaultValue: 0},
    {
        type: "UtcTime", realType: "DateTime", defaultValue: function () {
        return new Date();
    }
    },
//xx        {  type: "Int64",         defaultValue:  0},
    {type: "LocaleId", realType: "String", defaultValue: ""},
    {
        type: "LocalizedText", defaultValue: function () {
        return new LocalizedText({});
    }
    },


    {
        type: "QualifiedName", defaultValue: function () {
        return new QualifiedName();
    }
    },
    {type: "Time", realType: "String", defaultValue: "00:00:00"},
    {type: "UInt64", defaultValue: [0, 0]},
    {type: "Int64", defaultValue: [0, 0]},
//    {  type: "Variant",       defaultValue:  function() { return new Variant(); }},
    {type: "XmlElement", defaultValue: "<string1>OPCUA</string1>"},
    {type: "ImageBMP", realType: "ByteString"},
    {type: "ImageGIF", realType: "ByteString"},
    {type: "ImageJPG", realType: "ByteString"},
    {type: "ImagePNG", realType: "ByteString"},
];


function add_simulation_variables(server_engine, scalarFolder) {


    var values_to_change = [];

    function add_simulation_variable(parent, dataTypeName, defaultValue, realTypeName) {

        // the type of the default value
        realTypeName = realTypeName || dataTypeName;

        var dataType = _findDataType(realTypeName);
        var randomFunc = getRandomFuncForType(dataType);
        if (!_.isFunction(randomFunc)) {
            throw new Error("a random function must exist for basicType " + dataTypeName);
        }

        var variable = _add_variable(server_engine, parent, dataTypeName, realTypeName, defaultValue, false, "");

        var value_to_change = {
            dataType: dataType,
            variable: variable,
            randomFunc: randomFunc
        };

        values_to_change.push(value_to_change);

        return variable;
    }

    var simulation = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Simulation",
        description: "This folder will contain one item per supported data-type.",
        nodeId: makeNodeId("Scalar_Simulation", namespaceIndex)
    });


    // add simulation variables
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        var realType = e.realType || dataType;
        add_simulation_variable(simulation, dataType, defaultValue, realType);
    });


    // add management nodes
    var interval = 2000;
    var enabled = true;
    var timer;


    function change_randomly() {

        values_to_change.forEach(function (element) {

            var variant = element.variable._backdoor_placeholder.variant;
            variant.value = element.randomFunc();
            element.variable.setValueFromSource(variant);

        });
    }

    function delete_Timer() {
        // delete previous timer if any
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function install_Timer() {
        delete_Timer();
        assert(!timer);
        if (enabled) {
            timer = setInterval(function () {
                change_randomly();
            }, interval);
        }
    }

    function tearDown_Timer() {
        delete_Timer();
        values_to_change = [];
    }

    // var name = "Interval", "UInt16"
    var intervalVariable = server_engine.addVariable(simulation, {
        browseName: "Interval",
        description: {locale: "en", text: "The rate (in msec) of change for all Simulated items."},
        nodeId: makeNodeId("Scalar_Simulation_Interval", namespaceIndex),
        dataType: "UInt16",
        value: new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Scalar,
            value: interval
        })
    });

    intervalVariable.on("value_changed", function (dataValue/*,indexRange*/) {
        var variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidUInt16(variant.value) && " value must be valid for dataType");
        interval = variant.value;
        install_Timer();
    });


    var enabledVariable = server_engine.addVariable(simulation, {
        browseName: "Enabled",
        description: {locale: "en", text: "Enabled"},
        nodeId: makeNodeId("Scalar_Simulation_Enabled", namespaceIndex),
        dataType: "Boolean",
        value: new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Scalar,
            value: enabled
        })
    });
    enabledVariable.on("value_changed", function (dataValue/*,indexRange*/) {
        var variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidBoolean(variant.value) && " value must be valid for dataType");
        enabled = variant.value;
        install_Timer();
    });
    install_Timer();

    server_engine.registerShutdownTask(tearDown_Timer);

}

function add_scalar_static_variables(server_engine, scalarFolder) {

    var scalarStatic = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Static",
        description: "This folder will contain one item per supported data-type.",
        nodeId: makeNodeId("Scalar_Static", namespaceIndex)
    });

    // add statics scalar Variables
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        var defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_variable(server_engine, scalarStatic, dataType, realType, defaultValue, "");
    });


    // add statics Array Variables
    var scalarStaticArray = server_engine.addObjectInFolder(scalarFolder, {
        browseName: "Scalar_Static_Array",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: makeNodeId("Scalar_Static_Array", namespaceIndex)
    });
    // add static Array
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_variable_array(server_engine, scalarStaticArray, dataType, e.defaultValue, realType, 10 , "");
    });
    // add static Mass

}


function add_access_right_variables(server_engine, objectsFolder) {

    var accessRight_Folder = server_engine.addFolder(objectsFolder, {
        browseName: "AccessRight",
        description: "Folder containing various nodes with different access right behavior",
        nodeId: makeNodeId("AccessRight", namespaceIndex)
    });

    var accessLevel_All_Folder = server_engine.addFolder(accessRight_Folder, {
        browseName: "AccessLevel",
        description: "Various node with different access right behavior",
        nodeId: makeNodeId("AccessLevel", namespaceIndex)
    });


    var name = "AccessLevel_CurrentRead_NotCurrentWrite";
    server_engine.addVariable(accessLevel_All_Folder, {
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentRead",

        userAccessLevel: "CurrentRead",

        value: {
            // expect a Variant
            get: function () {
                return new Variant({
                    dataType: DataType.Int32,
                    arrayType: VariantArrayType.Scalar,
                    value: 36
                });
            },
            set: null
        }
    });

    var name = "AccessLevel_CurrentWrite";
    server_engine.addVariable(accessLevel_All_Folder, {
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,
        accessLevel: "CurrentWrite",
        userAccessLevel: "CurrentWrite",
        value: {}

    });

}

function add_very_large_array_variables(server_engine, objectsFolder) {

    // add statics Array Variables
    var scalarStaticLargeArray = server_engine.addObjectInFolder("RootFolder", {
        browseName: "Scalar_Static_Large_Array",
        description: "Single dimension, suggested size of 100k-elements per array.",
        nodeId: makeNodeId("Scalar_Static_Large_Array", namespaceIndex)
    });
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_variable_array(server_engine, scalarStaticLargeArray, dataType, e.defaultValue, realType, 50 * 1024 , "");
    });

}
//      BaseDataVariableType
//         |
//      DataItemType
//         ^
//         |
//      +----------------+---------------------+
//      |                |                     |
// ArrayItemType   AnalogItemType         DiscreteItemType
//                                             ^
//                                             |
//                +-----------------------------+---------------------------------+
//                |                             |                                 |
//           TwoStateDiscreteType     MultiStateDiscreteType                MutliStateValueDiscreteType
//
function add_analog_data_items(server_engine) {

    var standardUnits     = require("lib/data_access/EUInformation").standardUnits;
    var addAnalogDataItem = require("lib/data_access/UAAnalogItem").addAnalogDataItem;
    var addDataItem =require("lib/data_access/UAAnalogItem").addDataItem;

    function _addDataItem(parentFolder,dataType,initialValue) {

        if ( !(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        var name = dataType+"DataItem";
        var nodeId =  makeNodeId(name, namespaceIndex);
        addDataItem(parentFolder,{
            nodeId:nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            dataType: dataType,
            value: new Variant({
                arrayType: VariantArrayType.Scalar,
                dataType: DataType[dataType],
                value: initialValue
            })
        });
    }
    function _addAnalogDataItem(parentFolder,dataType) {
        if ( !(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        var name = dataType+"AnalogDataItem";
        var nodeId =  makeNodeId(name, namespaceIndex);
        // UAAnalogItem
        // add a UAAnalogItem
        addAnalogDataItem(parentFolder,{
            nodeId:nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
             engineeringUnitsRange: { low: 1 , high: 50},
             instrumentRange: { low: 1 , high: 50},
             engineeringUnits: standardUnits.degree_celsius,
             dataType: dataType,
             value: new Variant({
                 arrayType: VariantArrayType.Scalar,
                 dataType: DataType[dataType],
                 value: 25
             })
        });
    }
    // add statics Array Variables
    var parentFolder = server_engine.addObjectInFolder("RootFolder", {
        browseName: "Simulation_AnalogDataItem",
        nodeId: makeNodeId("Simulation_AnalogDataItem", namespaceIndex)
    });

    var name = "DoubleAnalogDataItemWithEU";
    var nodeId =  makeNodeId(name, namespaceIndex);

    addAnalogDataItem(parentFolder,{
        nodeId:nodeId,
        browseName: name,
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange: { low: 100 , high: 200},
        instrumentRange: { low: -100 , high: +200},
        engineeringUnits: standardUnits.degree_celsius,
        dataType: "Double",

        value: new Variant({
            dataType: DataType.Double,
            value: 19.5
        })
    });

    ["Double","Float","Int16","UInt16","Int32","UInt32","Int64","UInt64","Byte","SByte"]
    .forEach(function (dataType) {  _addAnalogDataItem(parentFolder,dataType); });

    [   {dataType: "Double", value: 3.14},
        {dataType: "Float",  value: 3.14},
        {dataType: "Int16",  value: -10},
        {dataType: "UInt16",  value: 10},
        {dataType: "Int32",  value: -100},
        {dataType: "UInt32",  value: 100},
        {dataType: "Int64",  value: [0,0]},
        {dataType: "UInt64",  value: [0,0]},
        {dataType: "Byte",  value:   120},
        {dataType: "SByte",  value:  -123},
        {dataType: "String",  value: "some string"},
        {dataType: "DateTime",  value: new Date()}
    ]
    .forEach(function (e) {  _addDataItem(parentFolder, e.dataType, e.value); });


}
build_address_space_for_conformance_testing = function (server_engine, options) {

    options = options || {};
    options.mass_variable = options.mass_variable || false;

    assert(server_engine instanceof ServerEngine);
    assert(server_engine.address_space instanceof AddressSpace);

    var objectsFolder = server_engine.findObject("ObjectsFolder");

    add_access_right_variables(server_engine, objectsFolder);

    var scalarFolder = server_engine.addFolder(objectsFolder, {
        browseName: "Scalar",
        description: "Simply a parent folder"
    });

    add_scalar_static_variables(server_engine, scalarFolder);
    if (options.mass_variables) {
        add_mass_variables(server_engine, scalarFolder);
    }
    add_simulation_variables(server_engine, scalarFolder);

    add_very_large_array_variables(server_engine, scalarFolder);

    add_analog_data_items(server_engine);

};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;
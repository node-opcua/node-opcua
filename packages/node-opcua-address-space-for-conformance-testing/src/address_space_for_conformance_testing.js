"use strict";
/**
 * @module opcua.server.simulation
 * @type {async|exports}
 * @class Simulator
 *
 */

var _ = require("underscore");
var assert = require("node-opcua-assert");
var path = require("path");
var fs = require("fs");


var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var address_space = require("node-opcua-address-space");
var AddressSpace = address_space.AddressSpace;

var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var buildVariantArray = require("node-opcua-variant").buildVariantArray;

var findBuiltInType = require("node-opcua-factory").findBuiltInType;
var DataValue =  require("node-opcua-data-value").DataValue;

var namespaceIndex = 411;

var ec = require("node-opcua-basic-types");
var QualifiedName = require("node-opcua-data-model").QualifiedName;
var LocalizedText = require("node-opcua-data-model").LocalizedText;

var standardUnits = require("node-opcua-data-access").standardUnits;

var add_eventGeneratorObject = require("node-opcua-address-space/test_helpers/add_event_generator_object").add_eventGeneratorObject;

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
            // istanbul ignore next
            throw new Error("Cannot find random" + dataType + "() func anywhere");
    }
}


function _findDataType(dataTypeName) {
    var builtInDataTypeName = findBuiltInType(dataTypeName);
    var dataType = DataType[builtInDataTypeName.name];
    // istanbul ignore next
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
            // istanbul ignore next
            if (!validatorFunc(value)) {
                throw new Error("default value must be valid for dataType " + variantValue + " at index " + i + " got " + value);
            }
        }

    } else {
        // scalar
        // istanbul ignore next
        if (!validatorFunc(variantValue)) {
            throw new Error("default value must be valid for dataType " + variantValue);
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

function _add_variable(addressSpace, parent, varName, dataTypeName, current_value, isArray, extra_name) {

    assert(typeof extra_name === "string");
    assert(addressSpace instanceof AddressSpace);

    var variant = makeVariant(dataTypeName, isArray, current_value);

    var name = parent.browseName.toString() + "_" + varName + extra_name;

    var nodeId = makeNodeId(name, namespaceIndex);

    var placeholder = {
        variant: variant
    };

    var variable = addressSpace.addVariable({
        componentOf: parent,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: nodeId,
        dataType: varName,
        valueRank: isArray ? 1 : -1,
        value: variant
    });
    variable._backdoor_placeholder = placeholder;
    assert(addressSpace.findNode(nodeId));
    return variable;
}


function add_variable(addressSpace, parent, name, realType, default_value, extra_name) {

    assert(typeof extra_name === "string");
    var initialValue = _.isFunction(default_value) ? default_value() : default_value;
    var variable = _add_variable(addressSpace, parent, name, realType, initialValue, false, extra_name);
    assert(variable.valueRank === -1);
    assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.historizing === false);
    return variable;
}

function add_variable_array(addressSpace, parent, dataTypeName, default_value, realTypeName, arrayLength, extra_name) {

    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");

    // istanbul ignore next
    if (!DataType[realTypeName]) {
        console.log("dataTypeName", dataTypeName);
        console.log("realTypeName", realTypeName);
    }

    assert(DataType[realTypeName], " expecting a valid real type");
    arrayLength = arrayLength || 10;

    var local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;

    var current_value = buildVariantArray(DataType[realTypeName], arrayLength, local_defaultValue);

    var variable = _add_variable(addressSpace, parent, dataTypeName, realTypeName, current_value, true, extra_name);

    assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
    assert(variable.historizing === false);

}


function add_mass_variables_of_type(addressSpace, parent, dataTypeName, default_value, realType) {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
    var nodeName = "Scalar_Mass_" + dataTypeName;

    //xx console.log("xxxx adding mass variable ", nodeName);
    var scalarMass_Type = addressSpace.addObject({
        organizedBy: parent,
        browseName: nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId(nodeName, namespaceIndex)
    });
    for (var i = 0; i <= 99; i++) {
        var extra_name = "_" + ("00" + i.toString()).substr(-2);
        var local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;
        _add_variable(addressSpace, scalarMass_Type, dataTypeName, realType, local_defaultValue, false, extra_name);
    }

}
function add_mass_variables(addressSpace, scalarFolder) {

    var scalarMass = addressSpace.addFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: makeNodeId("Scalar_Mass", namespaceIndex)
    });

    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_mass_variables_of_type(addressSpace, scalarMass, dataType, e.defaultValue, realType);
    });
}

/**
 * @method build_address_space_for_conformance_testing
 * @param addressSpace {ServerEngine}
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
    //xx {type: "Variant",   realType:   "Variant", defaultValue:  {} },
    {type: "XmlElement", defaultValue: "<string1>OPCUA</string1>"},
    {type: "ImageBMP", realType: "ByteString"},
    {type: "ImageGIF", realType: "ByteString"},
    {type: "ImageJPG", realType: "ByteString"},
    {type: "ImagePNG", realType: "ByteString"},
    // {type: "Enumeration", realType: "UInt32" , defaultValue:0}
];


function add_simulation_variables(addressSpace, scalarFolder) {


    var values_to_change = [];

    function add_simulation_variable(parent, dataTypeName, defaultValue, realTypeName) {

        // the type of the default value
        realTypeName = realTypeName || dataTypeName;

        var dataType = _findDataType(realTypeName);
        var randomFunc = getRandomFuncForType(dataType);

        // istanbul ignore next
        if (!_.isFunction(randomFunc)) {
            throw new Error("a random function must exist for basicType " + dataTypeName);
        }

        var variable = _add_variable(addressSpace, parent, dataTypeName, realTypeName, defaultValue, false, "");

        var value_to_change = {
            dataType: dataType,
            variable: variable,
            randomFunc: randomFunc
        };

        values_to_change.push(value_to_change);

        return variable;
    }

    var simulation = addressSpace.addObject({
        organizedBy: scalarFolder,
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
    var intervalVariable = addressSpace.addVariable({
        componentOf: simulation,
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


    var enabledVariable = addressSpace.addVariable({
        componentOf: simulation,
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

    addressSpace.registerShutdownTask(tearDown_Timer);

}

function add_scalar_static_variables(addressSpace, scalarFolder) {

    var scalarStatic = addressSpace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Static",
        description: "This folder will contain one item per supported data-type.",
        nodeId: makeNodeId("Scalar_Static", namespaceIndex)
    });

    // add statics scalar Variables
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        var defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_variable(addressSpace, scalarStatic, dataType, realType, defaultValue, "");
    });

    function setImage__(imageType, filename) {
        var fullpath = path.join(__dirname, "data", filename);
        var imageNode = addressSpace.findNode("ns=411;s=Scalar_Static_Image" + imageType);



        var options = {
            refreshFunc: function (callback) {
                fs.readFile(fullpath, function (err, data) {
                    if (err) {
                        return callback(null, new DataValue({
                            statusCode: StatusCodes.BadInternalError,
                            value: {dataType: "ByteString", value: null}
                        }));

                    }
                    assert(data instanceof Buffer);
                    callback(null, new DataValue({value: {dataType: "ByteString", value: data}}));
                });
            }
        };
        imageNode.bindVariable(options, /*overwrite=*/true);

    }
    function setImage(imageType, filename) {
        var fullpath = path.join(__dirname, "data", filename);
        var imageNode = addressSpace.findNode("ns=411;s=Scalar_Static_Image" + imageType);
        fs.readFile(fullpath, function (err, data) {
            imageNode.setValueFromSource(new Variant({dataType: DataType.ByteString, value: data}));
        });
    }
    setImage("BMP", "image.bmp");
    setImage("PNG", "tux.png");
    setImage("GIF", "gif-anime.gif");
    setImage("JPG", "tiger.jpg");


    // add statics Array Variables
    var scalarStaticArray = addressSpace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Static_Array",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: makeNodeId("Scalar_Static_Array", namespaceIndex)
    });
    // add static Array
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_variable_array(addressSpace, scalarStaticArray, dataType, e.defaultValue, realType, 10, "");
    });
    // add static Mass

}


function add_access_right_variables(addressSpace, parentFolder) {

    var accessRight_Folder = addressSpace.addFolder(parentFolder, {
        browseName: "AccessRight",
        description: "Folder containing various nodes with different access right behavior",
        nodeId: makeNodeId("AccessRight", namespaceIndex)
    });

    var accessLevel_All_Folder = addressSpace.addFolder(accessRight_Folder, {
        browseName: "AccessLevel",
        description: "Various node with different access right behavior",
        nodeId: makeNodeId("AccessLevel", namespaceIndex)
    });


    var name;

    name = "AccessLevel_CurrentRead";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentRead",
        userAccessLevel: "CurrentRead",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

    name = "AccessLevel_CurrentWrite";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,
        accessLevel: "CurrentWrite",
        userAccessLevel: "CurrentWrite",
        value: {}

    });

    name = "AccessLevel_CurrentRead_NotUser";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentRead",

        userAccessLevel: "",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

    name = "AccessLevel_CurrentWrite_NotUser";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentWrite | CurrentRead",

        userAccessLevel: "CurrentRead",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

    name = "AccessLevel_CurrentRead_NotCurrentWrite";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentRead",

        userAccessLevel: "CurrentRead",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });


    name = "AccessLevel_CurrentWrite_NotCurrentRead";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "CurrentWrite",

        userAccessLevel: "CurrentWrite",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

    name = "AccessLevel_DeniedAll";
    addressSpace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: makeNodeId(name, namespaceIndex),
        dataType: "Int32",
        valueRank: -1,

        accessLevel: "",
        userAccessLevel: "",

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });


}
function add_path_10deep(addressSpace, simulation_folder) {

    var parent = simulation_folder;
    for (var i = 1; i < 15; i++) {
        var name = "Path_" + i.toString() + "Deep";

        var child = addressSpace.addObject({
            organizedBy: parent,
            browseName: name,
            description: "A folder at the top of " + i + " elements",
            typeDefinition: "FolderType",
            nodeId: makeNodeId(name, namespaceIndex)
        });
        parent = child;
    }
}
function add_very_large_array_variables(addressSpace, objectsFolder) {

    // add statics Array Variables
    var scalarStaticLargeArray = addressSpace.addObject({
        organizedBy: objectsFolder,
        browseName: "Scalar_Static_Large_Array",
        description: "Single dimension, suggested size of 100k-elements per array.",
        nodeId: makeNodeId("Scalar_Static_Large_Array", namespaceIndex)
    });
    typeAndDefaultValue.forEach(function (e) {
        var dataType = e.type;
        var realType = e.realType || dataType;
        add_variable_array(addressSpace, scalarStaticLargeArray, dataType, e.defaultValue, realType, 50 * 1024, "");
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
function add_analog_data_items(addressSpace, parentFolder) {



    function _addDataItem(localParentFolder, dataType, initialValue) {

        // istanbul ignore next
        if (!(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        var name = dataType + "DataItem";
        var nodeId = makeNodeId(name, namespaceIndex);

        addressSpace.addDataItem({
            componentOf: localParentFolder,
            nodeId: nodeId,
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

    function _addAnalogDataItem(localParentFolder, dataType, initialValue) {

        // istanbul ignore next
        if (!(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        var name = dataType + "AnalogDataItem";
        var nodeId = makeNodeId(name, namespaceIndex);
        // UAAnalogItem
        // add a UAAnalogItem
        addressSpace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId: nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: {low: 1, high: 50},
            instrumentRange: {low: 1, high: 50},
            engineeringUnits: standardUnits.degree_celsius,
            dataType: dataType,
            value: new Variant({
                arrayType: VariantArrayType.Scalar,
                dataType: DataType[dataType],
                value: initialValue
            })
        });
    }

    function _addArrayAnalogDataItem(localParentFolder, dataType, initialValue) {
        // istanbul ignore next
        if (!(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }
        var name = dataType + "ArrayAnalogDataItem";
        var nodeId = makeNodeId(name, namespaceIndex);
        // UAAnalogItem
        // add a UAAnalogItem
        addressSpace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId: nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: {low: 1, high: 50},
            instrumentRange: {low: 1, high: 50},
            engineeringUnits: standardUnits.degree_celsius,
            dataType: dataType,
            value: new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType[dataType],
                value: [initialValue, initialValue]
            })
        });

    }

    // add statics Array Variables
    var analogItemFolder = addressSpace.addObject({
        organizedBy: parentFolder,
        browseName: "Simulation_AnalogDataItem",
        typeDefinition: "FolderType",
        nodeId: makeNodeId("Simulation_AnalogDataItem", namespaceIndex)
    });

    var name = "DoubleAnalogDataItemWithEU";
    var nodeId = makeNodeId(name, namespaceIndex);

    addressSpace.addAnalogDataItem({

        componentOf: analogItemFolder,
        nodeId: nodeId,
        browseName: name,
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange: {low: 100, high: 200},
        instrumentRange: {low: -100, high: +200},
        engineeringUnits: standardUnits.degree_celsius,
        dataType: "Double",

        value: new Variant({
            dataType: DataType.Double,
            value: 19.5
        })
    });


    var data = [
        {dataType: "Double", value: 3.14},
        {dataType: "Float", value: 3.14},
        {dataType: "Int16", value: -10},
        {dataType: "UInt16", value: 10},
        {dataType: "Int32", value: -100},
        {dataType: "UInt32", value: 100},
        {dataType: "Int64", value: [0, 0]},
        {dataType: "UInt64", value: [0, 0]},
        {dataType: "Byte", value: 120},
        {dataType: "SByte", value: -123},
        {dataType: "String", value: "some string"},
        {dataType: "DateTime", value: new Date()}
    ];

    data.forEach(function (e) {
        _addAnalogDataItem(analogItemFolder, e.dataType, e.value);
    });
    data.forEach(function (e) {
        _addDataItem(analogItemFolder, e.dataType, e.value);
    });
    data.forEach(function (e) {
        _addArrayAnalogDataItem(analogItemFolder, e.dataType, e.value);
    });


}

function getDADiscreteTypeFolder(addressSpace,parentFolder) {
    var name = "Simulation_DA_DiscreteType";
    var nodeId =  makeNodeId("Simulation_DA_DiscreteType", namespaceIndex);

    if (addressSpace.findNode(nodeId)){
        return addressSpace.findNode(nodeId);
    }
    var node =addressSpace.addObject({
        organizedBy: parentFolder,
        typeDefinition: "FolderType",
        browseName: name,
        nodeId: nodeId
    });
    return node;
}
function add_two_state_discrete_variables(addressSpace,parentFolder) {

    var DADiscreteTypeFolder = getDADiscreteTypeFolder(addressSpace,parentFolder);

    var twoStateDiscrete001 = addressSpace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("TwoStateDiscrete001",namespaceIndex),
        browseName: "TwoStateDiscrete001",
        trueState: "Enabled",
        falseState:"Disabled"
    });


    var twoStateDiscrete002 = addressSpace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("TwoStateDiscrete002",namespaceIndex),
        browseName: "TwoStateDiscrete002",
        trueState: "On",
        falseState:"Off",
        optionals:["TransitionTime","EffectiveDisplayName"]
    });

    var twoStateDiscrete003 = addressSpace.addTwoStateDiscrete({
        browseName: "twoStateDiscrete003",
        nodeId:  makeNodeId("TwoStateDiscrete003",namespaceIndex),
        optionals:["TransitionTime"],
        isTrueSubStateOf: twoStateDiscrete002
    });

    var twoStateDiscrete004 = addressSpace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("TwoStateDiscrete004",namespaceIndex),
        browseName: "TwoStateDiscrete004",
        trueState: "InProgress",
        falseState:"Stopped"
    });

    var twoStateDiscrete005 = addressSpace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("TwoStateDiscrete005",namespaceIndex),
        browseName: "TwoStateDiscrete005",
        trueState: "InProgress",
        falseState:"Stopped"
    });

    twoStateDiscrete001.setValueFromSource( {dataType: "Boolean", value: false});
    twoStateDiscrete002.setValueFromSource( {dataType: "Boolean", value: false});
    twoStateDiscrete003.setValueFromSource( {dataType: "Boolean", value: false});
    twoStateDiscrete004.setValueFromSource( {dataType: "Boolean", value: false});
    twoStateDiscrete005.setValueFromSource( {dataType: "Boolean", value: false});

}

function add_multi_state_discrete_variable(addressSpace,parentFolder) {

    var DADiscreteTypeFolder = getDADiscreteTypeFolder(addressSpace,parentFolder);

    //MultiStateDiscrete001
    var multiStateDiscrete001 =addressSpace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("MultiStateDiscrete001",namespaceIndex),
        browseName: "MultiStateDiscrete001",
        enumStrings: [ "Red","Orange","Green"],
        value: 1 // Orange
    });
    var makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;



    //MultiStateDiscrete002
    addressSpace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("MultiStateDiscrete002",namespaceIndex),
        browseName: "MultiStateDiscrete002",
        enumStrings: [ "Red","Orange","Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    addressSpace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("MultiStateDiscrete003",namespaceIndex),
        browseName: "MultiStateDiscrete003",
        enumStrings: [ "Red","Orange","Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    addressSpace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("MultiStateDiscrete004",namespaceIndex),
        browseName: "MultiStateDiscrete004",
        enumStrings: [ "Red","Orange","Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    addressSpace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId:  makeNodeId("MultiStateDiscrete005",namespaceIndex),
        browseName: "MultiStateDiscrete005",
        enumStrings: [ "Red","Orange","Green"],
        value: 1 // Orange
    });

}


function add_multi_state_value_discrete_variables(addressSpace, parentFolder) {

    var multistateValueDiscreteTypeFolder = addressSpace.addObject({
        organizedBy: parentFolder,
        typeDefinition: "FolderType",
        browseName: "Simulation_DA_MultiStateValueDiscreteType",
        nodeId: makeNodeId("Simulation_DA_MultiStateValueDiscreteType", namespaceIndex)
    });

    function _add_multi_state_variable(parentFolder, dataType) {

        var name = dataType + "MultiStateValueDiscrete";
        var nodeId = makeNodeId(name, namespaceIndex);

        var prop = addressSpace.addMultiStateValueDiscrete({
            organizedBy: parentFolder,
            browseName: name,
            nodeId: nodeId,
            dataType: dataType,
            enumValues: {"Red": 0xFF0000, "Orange": 0xFF9933, "Green": 0x00FF00, "Blue": 0x0000FF},
            value: 0xFF0000 // Red
        });

    }

    var data = [
        {dataType: "Int16", value: -10},
        {dataType: "UInt16", value: 10},
        {dataType: "Int32", value: -100},
        {dataType: "UInt32", value: 100},
        {dataType: "Int64", value: [0, 0]},
        {dataType: "UInt64", value: [0, 0]},
        {dataType: "Byte", value: 120},
        {dataType: "SByte", value: -123}
    ];
    data.forEach(function (e) {
        _add_multi_state_variable(multistateValueDiscreteTypeFolder, e.dataType);
    });

}

function add_ObjectWithMethod(addressSpace, parentFolder) {

    var namespaceIndex = 411;

    var myObject = addressSpace.addObject({
        nodeId: "ns=411;s=ObjectWithMethods",
        organizedBy: parentFolder,
        browseName: "ObjectWithMethods"
    });

    var methodNoArgs = addressSpace.addMethod(myObject, {
        ///xx modellingRule: "Mandatory",
        browseName: "MethodNoArgs",
        nodeId: makeNodeId("MethodNoArgs", namespaceIndex),
        //xx inputArguments: [],
        //xx outputArguments: []
    });
    assert(makeNodeId("MethodNoArgs", namespaceIndex).toString() === "ns=411;s=MethodNoArgs");
    assert(methodNoArgs.nodeId.toString() === "ns=411;s=MethodNoArgs");

    methodNoArgs.bindMethod(function (inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        var callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });


    var methodIO = addressSpace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodIO",
        nodeId: makeNodeId("MethodIO", namespaceIndex),

        inputArguments: [
            {
                name: "ShutterLag",
                description: {text: "specifies the number of seconds to wait before the picture is taken "},
                dataType: DataType.UInt32
            }
        ],

        outputArguments: [
            {
                name: "Result",
                description: {text: "the result"},
                dataType: "Int32"
            }
        ]
    });
    methodIO.bindMethod(function (inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        var callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: [
                {
                    dataType: DataType.Int32,
                    value: 42
                }
            ]
        };
        callback(null, callMethodResult);
    });

    var methodI = addressSpace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodI",
        nodeId: makeNodeId("MethodI", namespaceIndex),

        inputArguments: [
            {
                name: "ShutterLag",
                description: {text: "specifies the number of seconds to wait before the picture is taken "},
                dataType: DataType.UInt32
            }
        ],
        //xx outputArguments: []

    });
    methodI.bindMethod(function (inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        var callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });

    var methodO = addressSpace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodO",
        nodeId: makeNodeId("MethodO", namespaceIndex),

        //xx inputArguments: [],
        outputArguments: [
            {
                name: "Result",
                description: {text: "the result"},
                dataType: "Int32"
            }
        ]

    });
    methodO.bindMethod(function (inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        var callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: [
                {
                    dataType: DataType.Int32,
                    value: 42
                }
            ]
        };
        callback(null, callMethodResult);
    });

}


function add_enumeration_variable(addressSpace, parentFolder) {

    var myEnumType = addressSpace.addEnumerationType({
        browseName: "SimulationEnumerationType",
        enumeration: [
            {value: 1, displayName: "RUNNING"},
            {value: 2, displayName: "BLOCKED"},
            {value: 3, displayName: "IDLE"},
            {value: 4, displayName: "UNDER MAINTENANCE"}
        ]
    });

    // now instantiate a variable that have this type.
    var e = addressSpace.addVariable({
        organizedBy: parentFolder,
        propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
        dataType: myEnumType,
        browseName: "RunningState",
        value: {
            get: function () {
                return new Variant({dataType: DataType.Int32, value: 1})
            }
        }
    });

}

function add_trigger_nodes(addressSpace, parentFolder) {

    // ns=411;s=TriggerNode01 ns=411;s=TriggerNode02
    // add 2 nodes that generate an event when ever they are written to.

    function _add_trigger_node(browseName, nodeId) {
        var triggerNode = addressSpace.addVariable({
            browseName: browseName,
            nodeId: nodeId,
            organizedBy: parentFolder,
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value = 100.0;
        var getFunc = function () {
            return new Variant({
                dataType: DataType.Double,
                value: value
            });
        };
        var setFunc = function (variant) {

            value = variant.value;

            var server = addressSpace.rootFolder.objects.server;

            server.raiseEvent("MyEventType", {
                message: {
                    dataType: DataType.LocalizedText,
                    value: {text: "Hello World"}
                },
                severity: {
                    dataType: DataType.UInt32,
                    value: 32
                }

            });
        };

        var options = {
            get: getFunc,
            set: setFunc
        };
        triggerNode.bindVariable(options);
    }

    var triggerNode01 = _add_trigger_node("TriggerNode01", "ns=411;s=TriggerNode01");

    var triggerNode02 = _add_trigger_node("TriggerNode02", "ns=411;s=TriggerNode02");
}

function add_sampleView(addressSpace) {

    addressSpace.addView({
        organizedBy: addressSpace.rootFolder.views,
        browseName: "SampleView",
        nodeId: "ns=411;s=SampleView"
    });
}
build_address_space_for_conformance_testing = function (addressSpace, options) {

    options = options || {};
    options.mass_variable = options.mass_variable || false;

    assert(addressSpace instanceof AddressSpace);

    var objectsFolder = addressSpace.findNode("ObjectsFolder");

    var simulationFolder = addressSpace.addFolder(objectsFolder, "Simulation");

    add_access_right_variables(addressSpace, simulationFolder);

    var scalarFolder = addressSpace.addFolder(simulationFolder, {
        browseName: "Scalar",
        description: "Simply a parent folder"
    });

    add_scalar_static_variables(addressSpace, scalarFolder);
    if (options.mass_variables) {
        add_mass_variables(addressSpace, scalarFolder);
    }
    add_simulation_variables(addressSpace, scalarFolder);

    add_very_large_array_variables(addressSpace, scalarFolder);

    add_analog_data_items(addressSpace, simulationFolder);

    add_path_10deep(addressSpace, simulationFolder);

    add_ObjectWithMethod(addressSpace, simulationFolder);

    add_eventGeneratorObject(addressSpace, simulationFolder);

    add_sampleView(addressSpace);

    add_enumeration_variable(addressSpace, simulationFolder);

    add_multi_state_value_discrete_variables(addressSpace, simulationFolder);

    add_two_state_discrete_variables(addressSpace,simulationFolder);

    add_multi_state_discrete_variable(addressSpace,simulationFolder);


    add_trigger_nodes(addressSpace, simulationFolder);

};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;



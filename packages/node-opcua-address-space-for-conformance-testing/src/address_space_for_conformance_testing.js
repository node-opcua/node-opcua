"use strict";
/**
 * @module opcua.server.simulation
 * @type {async|exports}
 * @class Simulator
 *
 */

const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");


const coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const address_space = require("node-opcua-address-space");
const AddressSpace = address_space.AddressSpace;
const Namespace = address_space.Namespace;

const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const buildVariantArray = require("node-opcua-variant").buildVariantArray;

const findBuiltInType = require("node-opcua-factory").findBuiltInType;
const DataValue = require("node-opcua-data-value").DataValue;


const ec = require("node-opcua-basic-types");
const QualifiedName = require("node-opcua-data-model").QualifiedName;
const LocalizedText = require("node-opcua-data-model").LocalizedText;

const standardUnits = require("node-opcua-data-access").standardUnits;

const add_eventGeneratorObject = require("node-opcua-address-space/test_helpers/add_event_generator_object").add_eventGeneratorObject;

function defaultValidator(/*value*/) {
    return true;
}

function getValidatorFuncForType(dataType) {
    const f = ec["isValid" + dataType];
    return f || defaultValidator;
}

function getRandomFuncForType(dataType) {

    assert(dataType);
    const dataTypeName = DataType[dataType];

    const f = ec["random" + dataTypeName];

    if (f) {
        return f;
    }

    //xx console.log("xxxx dataType  ",dataType);
    switch (dataTypeName) {
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
                const element = ec.randomString();
                const content = ec.randomString();
                return "<" + element + ">" + content + "</" + element + ">";
            };
        default:
            // istanbul ignore next
            throw new Error("Cannot find random" + dataTypeName + "() func anywhere");
    }
}


function _findDataType(dataTypeName) {
    const builtInDataTypeName = findBuiltInType(dataTypeName);
    const dataType = DataType[builtInDataTypeName.name];
    // istanbul ignore next
    if (!dataType) {
        throw new Error(" dataType " + dataTypeName + " must exists");
    }
    return dataType;
}

function validate_value_or_array(isArray, variantValue, validatorFunc) {

    assert(_.isFunction(validatorFunc));
    let i, value;
    if (isArray) {

        const n = Math.min(10, variantValue.length);

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

    isArray = (isArray === null) ? false : isArray;
    let arrayType = VariantArrayType.Scalar;
    if (isArray) {
        arrayType = VariantArrayType.Array;
    }
    const dataType = _findDataType(dataTypeName);
    assert(!dataType.isAbstract);

    const validatorFunc = getValidatorFuncForType(dataType);

    validate_value_or_array(isArray, current_value, validatorFunc);

    const variant = new Variant({
        dataType: dataType,
        arrayType: arrayType,
        value: current_value
    });
    return variant;
}

function _add_variable(namespace, parent, varName, dataTypeName, current_value, isArray, extra_name) {

    const addressSpace = namespace.addressSpace;
    assert(typeof extra_name === "string");
    assert(addressSpace instanceof AddressSpace);

    const variant = makeVariant(dataTypeName, isArray, current_value);

    const name = parent.browseName.name.toString() + "_" + varName + extra_name;

    const nodeId = "s=" + name;

    const placeholder = {
        variant: variant
    };

    const variable = namespace.addVariable({
        componentOf: parent,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: nodeId,
        dataType: varName,
        valueRank: isArray ? 1 : -1,
        value: variant
    });
    variable._backdoor_placeholder = placeholder;
    return variable;
}

const AccessLevelFlag = require("node-opcua-data-model").AccessLevelFlag;
const coerceAccessLevelFlag =require("node-opcua-data-model").coerceAccessLevelFlag;

function add_variable(namespace, parent, name, realType, default_value, extra_name) {

    assert(typeof extra_name === "string");
    const initialValue = _.isFunction(default_value) ? default_value() : default_value;
    const variable = _add_variable(namespace, parent, name, realType, initialValue, false, extra_name);
    assert(variable.valueRank === -1);
    assert(variable.accessLevel === AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);
    return variable;
}

function add_variable_array(namespace, parent, dataTypeName, default_value, realTypeName, arrayLength, extra_name) {

    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");

    // istanbul ignore next
    if (!DataType[realTypeName]) {
        console.log("dataTypeName", dataTypeName);
        console.log("realTypeName", realTypeName);
    }

    assert(DataType[realTypeName], " expecting a valid real type");
    arrayLength = arrayLength || 10;

    const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;

    const current_value = buildVariantArray(DataType[realTypeName], arrayLength, local_defaultValue);

    const variable = _add_variable(namespace, parent, dataTypeName, realTypeName, current_value, true, extra_name);

    assert(variable.accessLevel === AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);

}


function add_mass_variables_of_type(namespace, parent, dataTypeName, default_value, realType) {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
    const nodeName = "Scalar_Mass_" + dataTypeName;

    //xx console.log("xxxx adding mass variable ", nodeName);
    const scalarMass_Type = namespace.addObject({
        organizedBy: parent,
        browseName: nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: "s=" + nodeName,
    });
    for (let i = 0; i <= 99; i++) {
        const extra_name = "_" + ("00" + i.toString()).substr(-2);
        const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;
        _add_variable(namespace, scalarMass_Type, dataTypeName, realType, local_defaultValue, false, extra_name);
    }

}

function add_mass_variables(namespace, scalarFolder) {

    const scalarMass = namespace.addFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: "s=Scalar_Mass"
    });

    typeAndDefaultValue.forEach(function (e) {
        const dataType = e.type;
        const realType = e.realType || dataType;
        add_mass_variables_of_type(namespace, scalarMass, dataType, e.defaultValue, realType);
    });
}

/**
 * @method build_address_space_for_conformance_testing
 * @param namespace {Namespace}
 * @param options
 * @param options.mass_variable {Boolean}
 */
let build_address_space_for_conformance_testing;


const DateTime_Min = new Date();
const typeAndDefaultValue = [
    {type: "Boolean", defaultValue: false},
    {type: "ByteString", defaultValue: Buffer.from("OPCUA")},
    {type: "DateTime", defaultValue: DateTime_Min},
    {type: "Double", defaultValue: 0.0},
    {type: "Float", defaultValue: 0.0},
    {type: "Guid", defaultValue: ec.emptyGuid},
    {type: "SByte", defaultValue: 0},
    {type: "Int16", defaultValue: 0},
    {type: "Int32", defaultValue: 0},
    {
        type: "NodeId", defaultValue: function () {
            return coerceNodeId("ns=" + 3+ ";g=00000000-0000-0000-0000-000000000023");
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
    {type: "ImageBMP", realType: "ByteString", defaultValue: null},
    {type: "ImageGIF", realType: "ByteString", defaultValue: null},
    {type: "ImageJPG", realType: "ByteString", defaultValue: null},
    {type: "ImagePNG", realType: "ByteString", defaultValue: null},
    // {type: "Enumeration", realType: "UInt32" , defaultValue:0}
];


function add_simulation_variables(namespace, scalarFolder) {


    let values_to_change = [];

    function add_simulation_variable(parent, dataTypeName, defaultValue, realTypeName) {

        // the type of the default value
        realTypeName = realTypeName || dataTypeName;

        const dataType = _findDataType(realTypeName);
        const randomFunc = getRandomFuncForType(dataType);

        // istanbul ignore next
        if (!_.isFunction(randomFunc)) {
            throw new Error("a random function must exist for basicType " + dataTypeName);
        }

        const variable = _add_variable(namespace, parent, dataTypeName, realTypeName, defaultValue, false, "");

        const value_to_change = {
            dataType: dataType,
            variable: variable,
            randomFunc: randomFunc
        };

        values_to_change.push(value_to_change);

        return variable;
    }

    const simulation = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Simulation",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Scalar_Simulation"
    });


    // add simulation variables
    typeAndDefaultValue.forEach(function (e) {
        const dataType = e.type;
        const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        const realType = e.realType || dataType;
        add_simulation_variable(simulation, dataType, defaultValue, realType);
    });


    // add management nodes
    let interval = 2000;
    let enabled = true;
    let timer;


    function change_randomly() {

        values_to_change.forEach(function (element) {

            const variant = element.variable._backdoor_placeholder.variant;
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

    const intervalVariable = namespace.addVariable({
        componentOf: simulation,
        browseName: "Interval",
        description: {locale: "en", text: "The rate (in msec) of change for all Simulated items."},
        nodeId: "s=Scalar_Simulation_Interval",
        dataType: "UInt16",
        value: new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Scalar,
            value: interval
        })
    });

    intervalVariable.on("value_changed", function (dataValue/*,indexRange*/) {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidUInt16(variant.value) && " value must be valid for dataType");
        interval = variant.value;
        install_Timer();
    });


    const enabledVariable = namespace.addVariable({
        componentOf: simulation,
        browseName: "Enabled",
        description: {locale: "en", text: "Enabled"},
        nodeId: "s=Scalar_Simulation_Enabled",
        dataType: "Boolean",
        value: new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Scalar,
            value: enabled
        })
    });
    enabledVariable.on("value_changed", function (dataValue/*,indexRange*/) {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidBoolean(variant.value) && " value must be valid for dataType");
        enabled = variant.value;
        install_Timer();
    });
    install_Timer();

    const addressSpace = namespace.addressSpace;
    addressSpace.registerShutdownTask(tearDown_Timer);

}

function add_scalar_static_variables(namespace, scalarFolder) {

    const scalarStatic = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Static",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Scalar_Static"
    });

    // add statics scalar Variables
    typeAndDefaultValue.forEach(function (e) {
        const dataType = e.type;
        const realType = e.realType || dataType;

        const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_variable(namespace, scalarStatic, dataType, realType, defaultValue, "");
    });

    function setImage2(imageType, filename) {
        const fullpath = path.join(__dirname, "../data", filename);
        const imageNode = namespace.findNode("s=Scalar_Static_Image" + imageType);

        const options = {
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
        const fullpath = path.join(__dirname, "../data", filename);
        const imageNode = namespace.findNode("s=Scalar_Static_Image" + imageType);
        fs.readFile(fullpath, function (err, data) {
            if (!err) {
                assert(data instanceof Buffer);
                imageNode.setValueFromSource(new Variant({dataType: DataType.ByteString, value: data}));
            } else {
                console.log("cannot load file =", fullpath);
            }
        });
    }

    setImage("BMP", "image.bmp");
    setImage("PNG", "tux.png");
    setImage("GIF", "gif-anime.gif");
    setImage("JPG", "tiger.jpg");


    // add statics Array Variables
    const scalarStaticArray = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Static_Array",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: "s=Scalar_Static_Array"
    });
    // add static Array
    typeAndDefaultValue.forEach(function (e) {
        const dataType = e.type;
        const realType = e.realType || dataType;
        add_variable_array(namespace, scalarStaticArray, dataType, e.defaultValue, realType, 10, "");
    });
    // add static Mass

}


function add_access_right_variables(namespace, parentFolder) {

    const accessRight_Folder = namespace.addFolder(parentFolder, {
        browseName: "AccessRight",
        description: "Folder containing various nodes with different access right behavior",
        nodeId: "s=AccessRight"
    });

    const accessLevel_All_Folder = namespace.addFolder(accessRight_Folder, {
        browseName: "AccessLevel",
        description: "Various node with different access right behavior",
        nodeId: "s=AccessLevel"
    });


    let name;

    name = "AccessLevel_CurrentRead";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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

    name = "s=AccessLevel_CurrentWrite";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,
        accessLevel: "CurrentWrite",
        userAccessLevel: "CurrentWrite",
        value: {}

    });

    name = "AccessLevel_CurrentRead_NotUser";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: {locale: "en", text: name},
        nodeId: "s=" + name,
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

function add_path_10deep(namespace, simulation_folder) {

    let parent = simulation_folder;
    for (let i = 1; i < 15; i++) {
        const name = "Path_" + i.toString() + "Deep";

        const child = namespace.addObject({
            organizedBy: parent,
            browseName: name,
            description: "A folder at the top of " + i + " elements",
            typeDefinition: "FolderType",
            nodeId: "s=" + name
        });
        parent = child;
    }
}

function add_very_large_array_variables(namespace, objectsFolder) {

    // add statics Array Variables
    const scalarStaticLargeArray = namespace.addObject({
        organizedBy: objectsFolder,
        browseName: "Scalar_Static_Large_Array",
        description: "Single dimension, suggested size of 100k-elements per array.",
        nodeId: "s=Scalar_Static_Large_Array"
    });
    typeAndDefaultValue.forEach(function (e) {
        const dataType = e.type;
        const realType = e.realType || dataType;
        add_variable_array(namespace, scalarStaticLargeArray, dataType, e.defaultValue, realType, 50 * 1024, "");
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
function add_analog_data_items(namespace, parentFolder) {


    function _addDataItem(localParentFolder, dataType, initialValue) {

        // istanbul ignore next
        if (!(DataType[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        const name = dataType + "DataItem";
        const nodeId = "s=" + name;

        namespace.addDataItem({
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

        const name = dataType + "AnalogDataItem";
        const nodeId = "s=" + name;
        // UAAnalogItem
        // add a UAAnalogItem
        namespace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId: nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: {low: -200, high: 200},
            instrumentRange: {low: -200, high: 200},
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
        const name = dataType + "ArrayAnalogDataItem";
        const nodeId = "s=" + name;
        // UAAnalogItem
        // add a UAAnalogItem
        namespace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId: nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: {low: -200, high: 200},
            instrumentRange: {low: -200, high: 200},
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
    const analogItemFolder = namespace.addObject({
        organizedBy: parentFolder,
        browseName: "Simulation_AnalogDataItem",
        typeDefinition: "FolderType",
        nodeId: "s=Simulation_AnalogDataItem"
    });

    const name = "DoubleAnalogDataItemWithEU";
    const nodeId = "s=" + name;

    namespace.addAnalogDataItem({

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


    const data = [
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

function getDADiscreteTypeFolder(namespace, parentFolder) {

    const name = "Simulation_DA_DiscreteType";
    const nodeId = "s=Simulation_DA_DiscreteType";

    let node = parentFolder.getFolderElementByName(name);
    if (!node) {

        node = namespace.addObject({
            organizedBy: parentFolder,
            typeDefinition: "FolderType",
            browseName: name,
            nodeId: nodeId
        });
    }
    return node;
}

function add_two_state_discrete_variables(namespace, parentFolder) {

    const DADiscreteTypeFolder = getDADiscreteTypeFolder(namespace, parentFolder);

    const twoStateDiscrete001 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete001",
        browseName: "TwoStateDiscrete001",
        trueState: "Enabled",
        falseState: "Disabled"
    });


    const twoStateDiscrete002 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete002",
        browseName: "TwoStateDiscrete002",
        trueState: "On",
        falseState: "Off",
        optionals: ["TransitionTime", "EffectiveDisplayName"]
    });

    const twoStateDiscrete003 = namespace.addTwoStateDiscrete({
        browseName: "twoStateDiscrete003",
        nodeId: "s=TwoStateDiscrete003",
        optionals: ["TransitionTime"],
        isTrueSubStateOf: twoStateDiscrete002
    });

    const twoStateDiscrete004 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete004",
        browseName: "TwoStateDiscrete004",
        trueState: "InProgress",
        falseState: "Stopped"
    });

    const twoStateDiscrete005 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete005",
        browseName: "TwoStateDiscrete005",
        trueState: "InProgress",
        falseState: "Stopped"
    });

    twoStateDiscrete001.setValueFromSource({dataType: "Boolean", value: false});
    twoStateDiscrete002.setValueFromSource({dataType: "Boolean", value: false});
    twoStateDiscrete003.setValueFromSource({dataType: "Boolean", value: false});
    twoStateDiscrete004.setValueFromSource({dataType: "Boolean", value: false});
    twoStateDiscrete005.setValueFromSource({dataType: "Boolean", value: false});

}

function add_multi_state_discrete_variable(namespace, parentFolder) {

    assert(namespace instanceof Namespace);

    const DADiscreteTypeFolder = getDADiscreteTypeFolder(namespace, parentFolder);

    //MultiStateDiscrete001
    const multiStateDiscrete001 = namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete001",
        browseName: "MultiStateDiscrete001",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });


    //MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete002",
        browseName: "MultiStateDiscrete002",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete003",
        browseName: "MultiStateDiscrete003",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete004",
        browseName: "MultiStateDiscrete004",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    //MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete005",
        browseName: "MultiStateDiscrete005",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

}


function add_multi_state_value_discrete_variables(namespaceDemo, parentFolder) {

    const multistateValueDiscreteTypeFolder = namespaceDemo.addObject({
        organizedBy: parentFolder,
        typeDefinition: "FolderType",
        browseName: "Simulation_DA_MultiStateValueDiscreteType",
        nodeId: "s=Simulation_DA_MultiStateValueDiscreteType"
    });

    function _add_multi_state_variable(parentFolder, dataType) {

        const name = dataType + "MultiStateValueDiscrete";
        const nodeId = "s=" + name;

        const prop = namespaceDemo.addMultiStateValueDiscrete({
            organizedBy: parentFolder,
            browseName: name,
            nodeId: nodeId,
            dataType: dataType,
            enumValues: {"Red": 0xFF0000, "Orange": 0xFF9933, "Green": 0x00FF00, "Blue": 0x0000FF},
            value: 0xFF0000 // Red
        });

    }

    const data = [
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

function add_ObjectWithMethod(namespace, parentFolder) {


    const myObject = namespace.addObject({
        nodeId: "s=ObjectWithMethods",
        organizedBy: parentFolder,
        browseName: "ObjectWithMethods"
    });

    const methodNoArgs = namespace.addMethod(myObject, {
        browseName: "MethodNoArgs",
        nodeId: "s=MethodNoArgs",
        //xx inputArguments: [],
        //xx outputArguments: []
    });
    assert(makeNodeId("MethodNoArgs", namespace.index).toString().match(/s=MethodNoArgs/));
    assert(methodNoArgs.nodeId.toString().match(/s=MethodNoArgs/));

    methodNoArgs.bindMethod(function (inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        const callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });


    const methodIO = namespace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodIO",
        nodeId: makeNodeId("MethodIO", namespace.index),

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
        const callMethodResult = {
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

    const methodI = namespace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodI",
        nodeId: "s=MethodI",

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
        const callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });

    const methodO = namespace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodO",
        nodeId: "s=MethodO",

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
        const callMethodResult = {
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


function add_enumeration_variable(namespaceDemo, parentFolder) {

    const addressSpace = namespaceDemo.addressSpace;

    const myEnumType = namespaceDemo.addEnumerationType({
        browseName: "SimulationEnumerationType",
        enumeration: [
            {value: 1, displayName: "RUNNING"},
            {value: 2, displayName: "BLOCKED"},
            {value: 3, displayName: "IDLE"},
            {value: 4, displayName: "UNDER MAINTENANCE"}
        ]
    });

    // now instantiate a variable that have this type.
    const e = namespaceDemo.addVariable({
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

function add_trigger_nodes(namespace, parentFolder) {

    const addressSpace = namespace.addressSpace;

    // add 2 nodes that generate an event when ever they are written to.
    function _add_trigger_node(browseName, nodeId) {
        const triggerNode = namespace.addVariable({
            browseName: browseName,
            nodeId: nodeId,
            organizedBy: parentFolder,
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        let value = 100.0;
        const getFunc = function () {
            return new Variant({
                dataType: DataType.Double,
                value: value
            });
        };
        const setFunc = function (variant) {

            value = variant.value;

            const server = addressSpace.rootFolder.objects.server;

            server.raiseEvent("1:MyEventType", {
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

        const options = {
            get: getFunc,
            set: setFunc
        };
        triggerNode.bindVariable(options);
    }

    const triggerNode01 = _add_trigger_node("TriggerNode01", "s=TriggerNode01");

    const triggerNode02 = _add_trigger_node("TriggerNode02", "s=TriggerNode02");
}

function add_sampleView(namespace) {

    const addressSpace = namespace.addressSpace;
    namespace.addView({
        organizedBy: addressSpace.rootFolder.views,
        browseName: "SampleView",
        nodeId: "s=SampleView"
    });
}

build_address_space_for_conformance_testing = function (addressSpace, options) {


    const namespace = addressSpace.registerNamespace("urn://node-opcua-simulator");

    options = options || {};
    options.mass_variable = options.mass_variable || false;

    assert(addressSpace instanceof AddressSpace);

    const objectsFolder = addressSpace.findNode("ObjectsFolder");

    const simulationFolder = namespace.addFolder(objectsFolder, "Simulation");

    add_access_right_variables(namespace, simulationFolder);

    const scalarFolder = namespace.addFolder(simulationFolder, {
        browseName: "Scalar",
        description: "Simply a parent folder"
    });

    add_scalar_static_variables(namespace, scalarFolder);
    if (options.mass_variables) {
        add_mass_variables(namespace, scalarFolder);
    }
    add_simulation_variables(namespace, scalarFolder);

    add_very_large_array_variables(namespace, scalarFolder);

    add_analog_data_items(namespace, simulationFolder);

    add_path_10deep(namespace, simulationFolder);

    add_ObjectWithMethod(namespace, simulationFolder);

    add_eventGeneratorObject(namespace, simulationFolder);

    add_sampleView(namespace);

    add_enumeration_variable(namespace, simulationFolder);

    add_multi_state_value_discrete_variables(namespace, simulationFolder);

    add_two_state_discrete_variables(namespace, simulationFolder);

    add_multi_state_discrete_variable(namespace, simulationFolder);

    add_trigger_nodes(namespace, simulationFolder);

};
exports.build_address_space_for_conformance_testing = build_address_space_for_conformance_testing;



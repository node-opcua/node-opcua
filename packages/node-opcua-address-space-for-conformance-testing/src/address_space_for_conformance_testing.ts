// tslint:disable: no-console
// tslint:disable: object-literal-sort-keys
// tslint:disable: no-shadowed-variable
/**
 * @module opcua.server.simulation
 * @class Simulator
 *
 */

import * as _ from "underscore";
import * as path from "path";
import * as fs from "fs";

import { assert } from "node-opcua-assert";
import { coerceNodeId, makeNodeId, NodeIdLike } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { AddressSpace, Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import {
    AccessLevelFlag,
    makeAccessLevelFlag
} from "node-opcua-data-model";
import {
    Variant,
    DataType,
    VariantArrayType,
    buildVariantArray
} from "node-opcua-variant";
import { findBuiltInType } from "node-opcua-factory";
import { DataValue } from "node-opcua-data-value";
import * as ec from "node-opcua-basic-types";
import {
    QualifiedName,
    LocalizedText
} from "node-opcua-data-model";
import {
    standardUnits
} from "node-opcua-data-access";
import { add_eventGeneratorObject } from "node-opcua-address-space";
import { UANamespace } from "node-opcua-address-space/src/namespace";

function defaultValidator(/*value*/) {
    return true;
}

function getValidatorFuncForType(dataType: DataType): any {
    const f = (ec as any)["isValid" + dataType];
    return f || defaultValidator;
}

function getRandomFuncForType(dataType: DataType): () => any {

    const dataTypeName = DataType[dataType];
    const f = (ec as any)["random" + dataTypeName];

    if (f) {
        return f;
    }

    switch (dataTypeName) {
        case "Variant":
            return () => {
                return new Variant();
            };
        case "QualifiedName":
            return () => {
                return new QualifiedName({ name: ec.randomString() });
            };
        case "LocalizedText":
            return () => {
                return new LocalizedText({ text: ec.randomString() });
            };
        case "XmlElement":
            return () => {
                const element = ec.randomString();
                const content = ec.randomString();
                return "<" + element + ">" + content + "</" + element + ">";
            };
        default:
            // istanbul ignore next
            throw new Error("Cannot find random" + dataTypeName + "() func anywhere");
    }
}

function _findDataType(dataTypeName: string) {
    const builtInDataTypeName = findBuiltInType(dataTypeName);
    const dataType = (DataType as any)[builtInDataTypeName.name];
    // istanbul ignore next
    if (!dataType) {
        throw new Error(" dataType " + dataTypeName + " must exists");
    }
    return dataType;
}

function validate_value_or_array(
    isArray: boolean, variantValue: any, validatorFunc: any) {

    assert(_.isFunction(validatorFunc));
    let i: number;
    let value: any;
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

function makeVariant(dataTypeName: string, isArray: boolean, current_value: any) {

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
        dataType,
        arrayType,
        value: current_value
    });
    return variant;
}

function _add_variable(
    namespace: Namespace,
    parent: UAObject,
    varName: string,
    dataTypeName: string,
    current_value: any,
    isArray: boolean,
    extra_name: string
): UAVariable {

    const addressSpace = namespace.addressSpace;
    assert(typeof extra_name === "string");

    const variant = makeVariant(dataTypeName, isArray, current_value);

    const name = parent.browseName.name!.toString() + "_" + varName + extra_name;

    const nodeId = "s=" + name;

    const placeholder = {
        variant
    };

    const variable = namespace.addVariable({
        browseName: name,
        componentOf: parent,
        dataType: varName,
        description: { locale: "en", text: name },
        nodeId,
        valueRank: isArray ? 1 : -1,

        accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        value: variant
    });
    (variable as any)._backdoor_placeholder = placeholder;
    return variable;
}

function add_variable(
    namespace: Namespace,
    parent: UAObject,
    name: string,
    realType: any,
    default_value: any,
    extra_name: string) {

    assert(typeof extra_name === "string");
    const initialValue = _.isFunction(default_value) ? default_value() : default_value;
    const variable = _add_variable(namespace, parent, name, realType, initialValue, false, extra_name);
    assert(variable.valueRank === -1);
    // tslint:disable-next-line: no-bitwise
    assert(variable.accessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    // tslint:disable-next-line: no-bitwise
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);
    return variable;
}

function add_variable_array(
    namespace: Namespace,
    parent: UAObject,
    dataTypeName: string,
    default_value: any, realTypeName: string,
    arrayLength: number,
    extra_name: string): void {

    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");

    // istanbul ignore next
    if (!(DataType as any)[realTypeName]) {
        console.log("dataTypeName", dataTypeName);
        console.log("realTypeName", realTypeName);
    }

    assert((DataType as any)[realTypeName], " expecting a valid real type");
    arrayLength = arrayLength || 10;

    const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;

    const current_value = buildVariantArray((DataType as any)[realTypeName], arrayLength, local_defaultValue);

    const variable = _add_variable(namespace, parent, dataTypeName, realTypeName, current_value, true, extra_name);

    assert(variable.accessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);

}

function add_mass_variables_of_type(
    namespace: Namespace,
    parent: UAObject,
    dataTypeName: string,
    default_value: any,
    realType: string): void {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
    const nodeName = "Scalar_Mass_" + dataTypeName;

    // xx console.log("xxxx adding mass variable ", nodeName);
    const scalarMass_Type = namespace.addObject({
        browseName: nodeName,
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: "s=" + nodeName,
        organizedBy: parent,
    });
    for (let i = 0; i <= 99; i++) {
        const extra_name = "_" + ("00" + i.toString()).substr(-2);
        const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;
        _add_variable(namespace, scalarMass_Type, dataTypeName, realType, local_defaultValue, false, extra_name);
    }

}

function add_mass_variables(namespace: Namespace, scalarFolder: UAObject): void {

    const scalarMass = namespace.addFolder(scalarFolder, {
        browseName: "Scalar_Mass",
        description: "This folder will contain 100 items per supported data-type.",
        nodeId: "s=Scalar_Mass"
    });

    typeAndDefaultValue.forEach((e) => {
        const dataType = e.type;
        const realType = e.realType || dataType;
        add_mass_variables_of_type(namespace, scalarMass, dataType, e.defaultValue, realType);
    });
}

const DateTime_Min = new Date();
const typeAndDefaultValue = [
    { type: "Boolean", defaultValue: false },
    { type: "ByteString", defaultValue: Buffer.from("OPCUA") },
    { type: "DateTime", defaultValue: DateTime_Min },
    { type: "Double", defaultValue: 0.0 },
    { type: "Float", defaultValue: 0.0 },
    { type: "Guid", defaultValue: ec.emptyGuid },
    { type: "SByte", defaultValue: 0 },
    { type: "Int16", defaultValue: 0 },
    { type: "Int32", defaultValue: 0 },
    {
        type: "NodeId", defaultValue() {
            return coerceNodeId("ns=" + 3 + ";g=00000000-0000-0000-0000-000000000023");
        }
    },
    { type: "String", defaultValue: "OPCUA" },
    { type: "Byte", defaultValue: 0 },
    { type: "UInt16", defaultValue: 0 },
    { type: "UInt32", defaultValue: 0 },
    { type: "Duration", realType: "Double", defaultValue: 0.0 },
    { type: "Number", realType: "UInt16", defaultValue: 0 },// Number is abstract
    { type: "Integer", realType: "Int64", defaultValue: 0 },// because Integer is abstract , we choose Int32
    { type: "UInteger", realType: "UInt64", defaultValue: 0 },
    {
        type: "UtcTime", realType: "DateTime", defaultValue() {
            return new Date();
        }
    },
    // xx        {  type: "Int64",         defaultValue:  0},
    { type: "LocaleId", realType: "String", defaultValue: "" },
    {
        type: "LocalizedText", defaultValue() {
            return new LocalizedText({});
        }
    },

    {
        type: "QualifiedName", defaultValue() {
            return new QualifiedName();
        }
    },
    { type: "Time", realType: "String", defaultValue: "00:00:00" },
    { type: "UInt64", defaultValue: [0, 0] },
    { type: "Int64", defaultValue: [0, 0] },
    // xx {type: "Variant",   realType:   "Variant", defaultValue:  {} },
    { type: "XmlElement", defaultValue: "<string1>OPCUA</string1>" },
    { type: "ImageBMP", realType: "ByteString", defaultValue: null },
    { type: "ImageGIF", realType: "ByteString", defaultValue: null },
    { type: "ImageJPG", realType: "ByteString", defaultValue: null },
    { type: "ImagePNG", realType: "ByteString", defaultValue: null },
    // {type: "Enumeration", realType: "UInt32" , defaultValue:0}
];

function add_simulation_variables(namespace: Namespace, scalarFolder: UAObject): void {

    let values_to_change: any[] = [];

    function add_simulation_variable(parent: UAObject,
        dataTypeName: string, defaultValue: any, realTypeName: string): UAVariable {

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
            dataType,
            randomFunc,
            variable,
        };

        values_to_change.push(value_to_change);

        return variable;
    }

    const simulation = namespace.addObject({
        browseName: "Scalar_Simulation",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Scalar_Simulation",
        organizedBy: scalarFolder,
    });

    // add simulation variables
    typeAndDefaultValue.forEach((e) => {
        const dataType = e.type;
        const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        const realType = e.realType || dataType;
        add_simulation_variable(simulation, dataType, defaultValue, realType);
    });

    // add management nodes
    let interval = 2000;
    let enabled = true;
    let timer: NodeJS.Timeout | undefined;

    function change_randomly() {

        values_to_change.forEach((element) => {

            const variant = element.variable._backdoor_placeholder.variant;
            variant.value = element.randomFunc();
            element.variable.setValueFromSource(variant);

        });
    }

    function delete_Timer() {
        // delete previous timer if any
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }
    }

    function install_Timer() {
        delete_Timer();
        assert(!timer);
        if (enabled) {
            timer = setInterval(() => {
                change_randomly();
            }, interval);
        }
    }

    function tearDown_Timer() {
        delete_Timer();
        values_to_change = [];
    }

    const intervalVariable = namespace.addVariable({
        browseName: "Interval",
        componentOf: simulation,
        dataType: "UInt16",
        description: { locale: "en", text: "The rate (in msec) of change for all Simulated items." },
        nodeId: "s=Scalar_Simulation_Interval",
        value: new Variant({
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.UInt16,
            value: interval
        })
    });

    intervalVariable.on("value_changed", (dataValue/*,indexRange*/) => {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidUInt16(variant.value), " value must be valid for dataType");
        interval = variant.value;
        install_Timer();
    });

    const enabledVariable = namespace.addVariable({
        componentOf: simulation,
        browseName: "Enabled",
        description: { locale: "en", text: "Enabled" },
        nodeId: "s=Scalar_Simulation_Enabled",
        dataType: "Boolean",
        value: new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Scalar,
            value: enabled
        })
    });

    enabledVariable.on("value_changed", (dataValue/*,indexRange*/) => {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(ec.isValidBoolean(variant.value), " value must be valid for dataType");
        enabled = variant.value;
        install_Timer();
    });
    install_Timer();

    const addressSpace = namespace.addressSpace;
    (addressSpace as any).registerShutdownTask(tearDown_Timer);

}

function add_scalar_static_variables(namespace: Namespace, scalarFolder: UAObject) {

    const scalarStatic = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalar_Static",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Scalar_Static"
    });

    // add statics scalar Variables
    typeAndDefaultValue.forEach((e) => {
        const dataType = e.type;
        const realType = e.realType || dataType;

        const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
        add_variable(namespace, scalarStatic, dataType, realType, defaultValue, "");
    });

    function setImage2(imageType: any, filename: string) {
        const fullpath = path.join(__dirname, "../data", filename);
        const imageNode = namespace.findNode("s=Scalar_Static_Image" + imageType) as UAVariable;

        const options = {
            refreshFunc: (callback: (err: Error | null, dataValue: DataValue) => void) => {
                fs.readFile(fullpath, (err, data) => {
                    if (err) {
                        return callback(null, new DataValue({
                            statusCode: StatusCodes.BadInternalError,
                            value: { dataType: "ByteString", value: null }
                        }));

                    }
                    assert(data instanceof Buffer);
                    callback(null, new DataValue({ value: { dataType: "ByteString", value: data } }));
                });
            }
        };

        imageNode.bindVariable(options, /*overwrite=*/true);

    }

    function setImage(imageType: string, filename: string) {
        const fullpath = path.join(__dirname, "../data", filename);
        const imageNode = namespace.findNode("s=Scalar_Static_Image" + imageType) as UAVariable;
        fs.readFile(fullpath, (err, data) => {
            if (!err) {
                assert(data instanceof Buffer);
                imageNode.setValueFromSource(new Variant({ dataType: DataType.ByteString, value: data }));
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
    typeAndDefaultValue.forEach((e) => {
        const dataType = e.type;
        const realType = e.realType || dataType;
        add_variable_array(namespace, scalarStaticArray, dataType, e.defaultValue, realType, 10, "");
    });
    // add static Mass

}

function add_access_right_variables(namespace: Namespace, parentFolder: UAObject): void {

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

    let name = "AccessLevel_CurrentRead";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag("CurrentRead"),
        userAccessLevel: makeAccessLevelFlag("CurrentRead"),

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

    name = "AccessLevel_CurrentWrite";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,
        accessLevel: makeAccessLevelFlag("CurrentWrite"),
        userAccessLevel: makeAccessLevelFlag("CurrentWrite"),
        value: {}

    });

    name = "AccessLevel_CurrentRead_NotUser";
    namespace.addVariable({
        componentOf: accessLevel_All_Folder,
        browseName: name,
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag("CurrentRead"),
        userAccessLevel: makeAccessLevelFlag(""),

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
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag("CurrentWrite | CurrentRead"),
        userAccessLevel: makeAccessLevelFlag("CurrentRead"),

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
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag("CurrentRead"),
        userAccessLevel: makeAccessLevelFlag("CurrentRead"),

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
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag("CurrentWrite"),
        userAccessLevel: makeAccessLevelFlag("CurrentWrite"),

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
        description: { locale: "en", text: name },
        nodeId: "s=" + name,
        dataType: "Int32",
        valueRank: -1,

        accessLevel: makeAccessLevelFlag(""),
        userAccessLevel: makeAccessLevelFlag(""),

        value: new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Scalar,
            value: 36
        })
    });

}

function add_node_with_references(namespace: Namespace, simulation_folder: UAObject): void {

    const parent = simulation_folder;
    const referenceFolder = namespace.addObject({
        browseName: "References",
        nodeId: "s=Demo.CTT.References",
        organizedBy: parent,
        typeDefinition: "FolderType"
    });

    (() => {
        const has3ForwardReferences1 = namespace.addObject({
            browseName: "Has3ForwardReferences1",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences1",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const referenceNode1 = namespace.addVariable({
            browseName: "ReferenceNode1",
            componentOf: has3ForwardReferences1,
            dataType: "UInt32"
        });
        const referenceNode2 = namespace.addVariable({
            browseName: "ReferenceNode2",
            componentOf: has3ForwardReferences1,
            dataType: "UInt32"
        });
        const referenceNode3 = namespace.addVariable({
            browseName: "ReferenceNode3",
            componentOf: has3ForwardReferences1,
            dataType: "UInt32"
        });

    })();

    (() => {
        const has3ForwardReferences2 = namespace.addObject({
            browseName: "Has3ForwardReferences2",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences2",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const baseDataVariable = namespace.addVariable({
            browseName: "BaseDataVariable",
            componentOf: has3ForwardReferences2,
            dataType: "UInt32"
        })
        const method1 = namespace.addMethod(has3ForwardReferences2, {
            browseName: "Method1",
        });
        const method2 = namespace.addMethod(has3ForwardReferences2, {
            browseName: "Method2",
        });
        const method3 = namespace.addMethod(has3ForwardReferences2, {
            browseName: "Method3",
        });
        const property = namespace.addVariable({
            browseName: "Property",
            propertyOf: has3ForwardReferences2,
            dataType: "UInt32"
        });
    })();

    (() => {
        const has3ForwardReferences3 = namespace.addObject({
            browseName: "Has3ForwardReferences3",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences3",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const referencedNode1 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode1");
        const referencedNode2 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode2");
        const referencedNode3 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode3");

        const has3InverseReferences = namespace.addObject({
            browseName: "Has3InverseReferences",
            nodeId: "s=Demo.CTT.References.Has3InverseReferences",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });

        referencedNode1.addReference({
            referenceType: "Organizes",
            nodeId: has3InverseReferences
        });
        referencedNode2.addReference({
            referenceType: "Organizes",
            nodeId: has3InverseReferences
        });
        referencedNode3.addReference({
            referenceType: "Organizes",
            nodeId: has3InverseReferences
        });

    })();

    (() => {
        const has3ForwardReferences4 = namespace.addObject({
            browseName: "Has3ForwardReferences4",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences4",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const prop1 = namespace.addVariable({
            browseName: "ReferenceNode1",
            propertyOf: has3ForwardReferences4,
            dataType: "UInt32"
        });
        const prop2 = namespace.addVariable({
            browseName: "ReferenceNode2",
            propertyOf: has3ForwardReferences4,
            dataType: "UInt32"
        });
        const prop3 = namespace.addVariable({
            browseName: "ReferenceNode3",
            propertyOf: has3ForwardReferences4,
            dataType: "UInt32"
        });

    })();
    (() => {
        const has3ForwardReferences5 = namespace.addObject({
            browseName: "Has3ForwardReferences5",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences5",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });

        namespace.addFolder(has3ForwardReferences5, {
            browseName: "ReferenceNode1"
        });
        namespace.addVariable({
            browseName: "ReferenceNode2",
            propertyOf: has3ForwardReferences5,
            dataType: "UInt32"
        });
        const method3 = namespace.addMethod(has3ForwardReferences5, {
            browseName: "ReferenceNode3",
        });

    })();

    (() => {
        const hasInverseAndForwardReferences = namespace.addObject({
            browseName: "HasInverseAndForwardReferences",
            nodeId: "s=Demo.CTT.References.HasInverseAndForwardReferences",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        namespace.addFolder(hasInverseAndForwardReferences, {
            browseName: "ReferenceNode1"
        });

    })();

    const hasReferencesWithDifferentParentTypes = namespace.addObject({
        browseName: "HasReferencesWithDifferentParentTypes",
        nodeId: "s=Demo.CTT.References.HasReferencesWithDifferentParentTypes",
        componentOf: referenceFolder,
        typeDefinition: "FolderType"
    });
}
function add_path_10deep(namespace: Namespace, simulation_folder: UAObject) {

    let parent = simulation_folder;
    for (let i = 1; i <= 10; i++) {
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

function add_very_large_array_variables(namespace: Namespace, objectsFolder: UAObject): void {

    // add statics Array Variables
    const scalarStaticLargeArray = namespace.addObject({
        organizedBy: objectsFolder,
        browseName: "Scalar_Static_Large_Array",
        description: "Single dimension, suggested size of 100k-elements per array.",
        nodeId: "s=Scalar_Static_Large_Array"
    });
    typeAndDefaultValue.forEach((e) => {
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
function add_analog_data_items(namespace: Namespace, parentFolder: UAObject): void {

    function _addDataItem(
        localParentFolder: UAObject,
        dataType: string,
        initialValue: any): void {

        // istanbul ignore next
        if (!((DataType as any)[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        const name = dataType + "DataItem";
        const nodeId = "s=" + name;

        namespace.addDataItem({
            componentOf: localParentFolder,
            nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            dataType,
            value: new Variant({
                arrayType: VariantArrayType.Scalar,
                dataType: (DataType as any)[dataType],
                value: initialValue
            })
        });
    }
    function makeRange(dataTypeStr: string): any {
        assert(typeof dataTypeStr === "string");
        const dataType = (DataType as any)[dataTypeStr];
        let engineeringUnitsRange = { low: -200, high: 200 };
        let instrumentRange = { low: -200, high: 200 };
        if (DataType[dataType][0] === "U" || dataType === DataType.Byte) {
            engineeringUnitsRange = { low: 10, high: 250 };
            instrumentRange = { low: 10, high: 250 };
        }
        return { engineeringUnitsRange, instrumentRange };
    }
    function _addAnalogDataItem(localParentFolder: UAObject, dataType: string, initialValue: any): void {

        // istanbul ignore next
        if (!((DataType as any)[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }

        const { engineeringUnitsRange, instrumentRange } = makeRange(dataType);
        assert(_.isArray(initialValue) || (initialValue >= engineeringUnitsRange.low && initialValue <= engineeringUnitsRange.high));
        const name = dataType + "AnalogDataItem";
        const nodeId = "s=" + name;
        // UAAnalogItem
        // add a UAAnalogItem
        namespace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange,
            instrumentRange,
            engineeringUnits: standardUnits.degree_celsius,
            dataType,
            value: new Variant({
                arrayType: VariantArrayType.Scalar,
                dataType: (DataType as any)[dataType],
                value: initialValue
            })
        });
    }

    function _addArrayAnalogDataItem(localParentFolder: UAObject,
        dataType: string,
        initialValue: any
    ) {
        // istanbul ignore next
        if (!((DataType as any)[dataType])) {
            throw new Error(" Invalid dataType " + dataType);
        }
        const name = dataType + "ArrayAnalogDataItem";
        const nodeId = "s=" + name;
        // UAAnalogItem
        const { engineeringUnitsRange, instrumentRange } = makeRange(dataType);
        // add a UAAnalogItem
        namespace.addAnalogDataItem({

            componentOf: localParentFolder,

            nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange,
            instrumentRange,
            engineeringUnits: standardUnits.degree_celsius,
            dataType,
            value: new Variant({
                arrayType: VariantArrayType.Array,
                dataType: (DataType as any)[dataType],
                value: [initialValue, initialValue, initialValue, initialValue, initialValue]
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

    const { engineeringUnitsRange, instrumentRange } = makeRange("Double");
    namespace.addAnalogDataItem({

        componentOf: analogItemFolder,
        nodeId,
        browseName: name,
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange,
        instrumentRange,
        engineeringUnits: standardUnits.degree_celsius,
        dataType: DataType.Double,

        value: new Variant({
            dataType: DataType.Double,
            value: 19.5
        })
    });

    const data = [
        { dataType: "Double", value: 3.14 },
        { dataType: "Float", value: 3.14 },
        { dataType: "Int16", value: -10 },
        { dataType: "UInt16", value: 10 },
        { dataType: "Int32", value: -100 },
        { dataType: "UInt32", value: 100 },
        { dataType: "Int64", value: [0, 0] },
        { dataType: "UInt64", value: [0, 0] },
        { dataType: "Byte", value: 65 },
        { dataType: "SByte", value: -23 },
    ];

    data.forEach((e) => {
        _addAnalogDataItem(analogItemFolder, e.dataType, e.value);
    });

    data.forEach((e) => {
        _addDataItem(analogItemFolder, e.dataType, e.value);
    });
    _addDataItem(analogItemFolder, "String", "some string");
    _addDataItem(analogItemFolder, "DateTime", new Date());

    data.forEach((e) => {
        _addArrayAnalogDataItem(analogItemFolder, e.dataType, e.value);
    });

}

function getDADiscreteTypeFolder(namespace: Namespace, parentFolder: UAObject): UAObject {

    const name = "Simulation_DA_DiscreteType";
    const nodeId = "s=Simulation_DA_DiscreteType";

    let node = parentFolder.getFolderElementByName(name);
    if (!node) {

        node = namespace.addObject({
            organizedBy: parentFolder,
            typeDefinition: "FolderType",
            browseName: name,
            nodeId
        });
    }
    return node as UAObject;
}

function add_two_state_discrete_variables(namespace: Namespace, parentFolder: UAObject): void {

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

    twoStateDiscrete001.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete002.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete003.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete004.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete005.setValueFromSource({ dataType: "Boolean", value: false });

}

function add_multi_state_discrete_variable(namespace: Namespace, parentFolder: UAObject): void {

    const DADiscreteTypeFolder = getDADiscreteTypeFolder(namespace, parentFolder);

    // MultiStateDiscrete001
    const multiStateDiscrete001 = namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete001",
        browseName: "MultiStateDiscrete001",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    // MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete002",
        browseName: "MultiStateDiscrete002",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    // MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete003",
        browseName: "MultiStateDiscrete003",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    // MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete004",
        browseName: "MultiStateDiscrete004",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

    // MultiStateDiscrete002
    namespace.addMultiStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=MultiStateDiscrete005",
        browseName: "MultiStateDiscrete005",
        enumStrings: ["Red", "Orange", "Green"],
        value: 1 // Orange
    });

}

function add_multi_state_value_discrete_variables(namespaceDemo: Namespace, parentFolder: UAObject): void {

    const multistateValueDiscreteTypeFolder = namespaceDemo.addObject({
        organizedBy: parentFolder,
        typeDefinition: "FolderType",
        browseName: "Simulation_DA_MultiStateValueDiscreteType",
        nodeId: "s=Simulation_DA_MultiStateValueDiscreteType"
    });

    function _add_multi_state_variable(parentFolder: UAObject, dataType: string) {

        const name = dataType + "MultiStateValueDiscrete";
        const nodeId = "s=" + name;

        const prop = namespaceDemo.addMultiStateValueDiscrete({
            organizedBy: parentFolder,
            browseName: name,
            nodeId,
            dataType,
            enumValues: { "Red": 0xFF0000, "Orange": 0xFF9933, "Green": 0x00FF00, "Blue": 0x0000FF },
            value: 0xFF0000 // Red
        });

    }

    const data = [
        { dataType: "Int16", value: -10 },
        { dataType: "UInt16", value: 10 },
        { dataType: "Int32", value: -100 },
        { dataType: "UInt32", value: 100 },
        { dataType: "Int64", value: [0, 0] },
        { dataType: "UInt64", value: [0, 0] },
        { dataType: "Byte", value: 120 },
        { dataType: "SByte", value: -123 }
    ];
    data.forEach((e) => {
        _add_multi_state_variable(multistateValueDiscreteTypeFolder, e.dataType);
    });

}

function add_ObjectWithMethod(namespace: Namespace, parentFolder: UAObject) {

    const myObject = namespace.addObject({
        nodeId: "s=ObjectWithMethods",
        organizedBy: parentFolder,
        browseName: "ObjectWithMethods"
    });

    const methodNoArgs = namespace.addMethod(myObject, {
        browseName: "MethodNoArgs",
        nodeId: "s=MethodNoArgs",
        // xx inputArguments: [],
        // xx outputArguments: []
    });
    assert(makeNodeId("MethodNoArgs", namespace.index).toString().match(/s=MethodNoArgs/));
    assert(methodNoArgs.nodeId.toString().match(/s=MethodNoArgs/));

    methodNoArgs.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
        const callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });

    const methodIO = namespace.addMethod(myObject, {

        /// xx modellingRule: "Mandatory",

        browseName: "MethodIO",
        nodeId: makeNodeId("MethodIO", namespace.index),

        inputArguments: [
            {
                name: "ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: DataType.UInt32
            }
        ],

        outputArguments: [
            {
                name: "Result",
                description: { text: "the result" },
                dataType: "Int32"
            }
        ]
    });
    methodIO.bindMethod((inputArguments, context, callback) => {
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

        /// xx modellingRule: "Mandatory",

        browseName: "MethodI",
        nodeId: "s=MethodI",

        inputArguments: [
            {
                name: "ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: DataType.UInt32
            }
        ],
        // xx outputArguments: []

    });
    methodI.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
        const callMethodResult = {
            statusCode: StatusCodes.Good,
            outputArguments: []
        };
        callback(null, callMethodResult);
    });

    const methodO = namespace.addMethod(myObject, {

        /// xx modellingRule: "Mandatory",

        browseName: "MethodO",
        nodeId: "s=MethodO",

        // xx inputArguments: [],
        outputArguments: [
            {
                name: "Result",
                description: { text: "the result" },
                dataType: "Int32"
            }
        ]

    });
    methodO.bindMethod((inputArguments, context, callback) => {
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

function add_enumeration_variable(namespaceDemo: Namespace, parentFolder: UAObject): void {

    const addressSpace = namespaceDemo.addressSpace;

    const myEnumType = namespaceDemo.addEnumerationType({
        browseName: "SimulationEnumerationType",
        enumeration: [
            { value: 1, displayName: "RUNNING" },
            { value: 2, displayName: "BLOCKED" },
            { value: 3, displayName: "IDLE" },
            { value: 4, displayName: "UNDER MAINTENANCE" }
        ]
    });

    // now instantiate a variable that have this type.
    const e = namespaceDemo.addVariable({
        organizedBy: parentFolder,
        propertyOf: (addressSpace.rootFolder.objects.server as any).vendorServerInfos,
        dataType: myEnumType,
        browseName: "RunningState",
        value: {
            get() {
                return new Variant({ dataType: DataType.Int32, value: 1 })
            }
        }
    });

}

function add_trigger_nodes(namespace: Namespace, parentFolder: UAObject): void {

    const addressSpace = namespace.addressSpace;

    // add 2 nodes that generate an event when ever they are written to.
    function _add_trigger_node(browseName: string, nodeId: NodeIdLike) {
        const triggerNode = namespace.addVariable({
            browseName,
            nodeId,
            organizedBy: parentFolder,
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        let value = 100.0;
        const getFunc = () => {
            return new Variant({
                dataType: DataType.Double,
                value
            });
        };
        const setFunc = (variant: Variant) => {

            value = variant.value;

            const server = addressSpace.rootFolder.objects.server;

            server.raiseEvent("3:MyEventType", {
                message: {
                    dataType: DataType.LocalizedText,
                    value: { text: "Hello World" }
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

function add_sampleView(namespace: Namespace): void {

    const addressSpace = namespace.addressSpace;
    namespace.addView({
        organizedBy: addressSpace.rootFolder.views,
        browseName: "SampleView",
        nodeId: "s=SampleView"
    });
}

export function build_address_space_for_conformance_testing(
    addressSpace: AddressSpace,
    options: any) {

    const namespace = addressSpace.registerNamespace("urn://node-opcua-simulator");

    options = options || {};
    options.mass_variable = options.mass_variable || false;

    const objectsFolder = addressSpace.findNode("ObjectsFolder") as UAObject;

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

    add_node_with_references(namespace, simulationFolder);

    add_ObjectWithMethod(namespace, simulationFolder);

    add_eventGeneratorObject(namespace, simulationFolder);

    add_sampleView(namespace);

    add_enumeration_variable(namespace, simulationFolder);

    add_multi_state_value_discrete_variables(namespace, simulationFolder);

    add_two_state_discrete_variables(namespace, simulationFolder);

    add_multi_state_discrete_variable(namespace, simulationFolder);

    add_trigger_nodes(namespace, simulationFolder);

};

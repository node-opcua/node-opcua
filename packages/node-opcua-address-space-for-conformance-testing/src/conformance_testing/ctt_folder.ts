/**
 * The `CTT` folder: nodes named after the settings of the OPC Foundation
 * Compliance Test Tool (UACTT) server project.
 *
 * The browse path below Objects/CTT mirrors the setting path below
 * "Server Test/NodeIds", e.g. the setting
 *   Server Test/NodeIds/Static/HA Profile/Arrays/Int162D
 * is served by
 *   Objects/CTT/Static/HA Profile/Arrays/Int162D   (NodeId s=CTT/Static/HA Profile/Arrays/Int162D)
 * so a CTT project generator can fill the setting by browsing, without any
 * hand-maintained map. See ./ctt_tree.ts for how a setting outside that prefix
 * is keyed. Only settings the rest of this address space does not already serve
 * are built here - plus the two Bool settings, see addBooleanScalarAndArray().
 *
 * Not covered, and why:
 *   Decimal                             deprecated in OPC UA 1.05
 *   the HA Aggregates nodes             need node-opcua-aggregates and a seeded
 *                                       history matching the CTT's StartOfBadData*
 *   NodeDoesNotSupportServerTimestamp   needs the variable read path to omit it
 *   NodeManagement/RootNode             the server has no AddNodes service
 *   Chattering Alarms                   needs an alarm that flips state on its own
 *   DiscrepancyAlarmType Input Nodes    see ./alarm_input_nodes.ts
 */
import fs from "node:fs";
import path from "node:path";
import type { AddressSpace, Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { standardUnits } from "node-opcua-data-access";
import { AccessLevelFlag } from "node-opcua-data-model";
import { buildVariantArray, DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { addAlarmInputNodes } from "./alarm_input_nodes.js";
import { CttFolder, readWrite, TYPE_ALIAS } from "./ctt_tree.js";

// ─── Static / All Profiles ──────────────────────────────────────────────

function addVariantVariables(ctt: CttFolder): void {
    // "Variant" in CTT terms: a Variable whose DataType attribute is BaseDataType
    const scalar = new Variant({ dataType: DataType.Double, value: 3.14 });
    ctt.variable("Static/All Profiles/Scalar/Variant", "BaseDataType", -1, scalar, null);
    // The array is the one case the CTT actually type-checks: Attribute Read 023.js
    // asserts AssertUaValueOfType(BuiltInType.Variant, ...) against this node, so the
    // *value* has to be Variant-encoded (BuiltInType 24), not merely stored on a
    // BaseDataType-typed Variable. A Float64Array reads back as Double (11) and fails
    // that assertion. Mixed element types are also the point of the type, and exercise
    // the encoder the way the test intends.
    ctt.variable(
        "Static/All Profiles/Arrays/Variant",
        "BaseDataType",
        1,
        new Variant({
            dataType: DataType.Variant,
            arrayType: VariantArrayType.Array,
            value: [
                new Variant({ dataType: DataType.Double, value: 1 }),
                new Variant({ dataType: DataType.UInt32, value: 2 }),
                new Variant({ dataType: DataType.String, value: "three" }),
                new Variant({ dataType: DataType.Boolean, value: true }),
                new Variant({ dataType: DataType.Float, value: 5.5 })
            ]
        }),
        [5]
    );
    ctt.variable(
        "Static/All Profiles/Multi-Dimensional-Arrays/Variant",
        "BaseDataType",
        2,
        new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: new Float64Array([1, 2, 3, 4, 5, 6])
        }),
        [2, 3]
    );
}

/**
 * `Static/All Profiles/Scalar/Bool` and `.../Arrays/Bool`, which the Simulation
 * folder would otherwise serve.
 *
 * A generator resolves a setting by overlay, then convention, then the CTT's own
 * default, then by *browse name*, then by rule. The HA Profile nodes below are
 * browse-named after their setting leaf, so `Static/HA Profile/Scalar/Bool` is
 * literally named `Bool` - and the name step matches it against the All Profiles
 * `Bool` settings, for which there is no convention node, while the Simulation
 * node named `Boolean` matches neither. The name step runs before the rule step,
 * so those two settings would silently resolve to a historizing node. Every other
 * type name is safe: `Byte`, `Double` and the rest match both nodes and the rule
 * scoring then prefers the non-historizing one.
 *
 * Building the two nodes here makes the convention step answer first, which is
 * both deterministic and where the CTT-specific extras belong - hence the two
 * Description properties, which View Minimum Continuation Point 01 012 needs
 * (it browses the Scalar/Bool setting node with a NodeClassMask of Variable and
 * wants at least two such references).
 */
function addBooleanScalarAndArray(ctt: CttFolder): void {
    const scalar = ctt.typedVariable("Static/All Profiles/Scalar/Bool", "Boolean", -1);
    for (const name of ["Description1", "Description2"]) {
        ctt.namespace.addVariable({
            propertyOf: scalar,
            browseName: name,
            nodeId: ctt.nodeId(`Static/All Profiles/Scalar/Bool/${name}`),
            dataType: "String",
            value: new Variant({ dataType: DataType.String, value: `${name} of the static Boolean` })
        });
    }
    ctt.typedVariable("Static/All Profiles/Arrays/Bool", "Boolean", 1);
}

function addImageVariable(ctt: CttFolder): void {
    // the abstract Image data type (the concrete ImagePNG/GIF/JPG/BMP nodes live under Simulation)
    let png: Buffer;
    try {
        png = fs.readFileSync(path.join(__dirname, "../../data", "tux.png"));
    } catch (_err) {
        png = Buffer.from("89504e470d0a1a0a", "hex");
    }
    ctt.variable("Static/All Profiles/Scalar/Image", "Image", -1, new Variant({ dataType: DataType.ByteString, value: png }), null);
}

function addStructureVariables(ctt: CttFolder): void {
    const addressSpace = ctt.addressSpace;
    const structures: { dataType: string; fields: Record<string, unknown> }[] = [
        { dataType: "Range", fields: { low: -10, high: 10 } },
        {
            dataType: "EUInformation",
            fields: {
                namespaceUri: "http://www.opcfoundation.org/UA/units/un/cefact",
                unitId: 4408652,
                displayName: { text: "°C" },
                description: { text: "degree Celsius" }
            }
        },
        { dataType: "TimeZoneDataType", fields: { offset: 60, daylightSavingInOffset: false } },
        {
            dataType: "EnumValueType",
            fields: { value: [1, 0], displayName: { text: "One" }, description: { text: "the value one" } }
        },
        {
            dataType: "Argument",
            fields: {
                name: "arg",
                dataType: "i=6",
                valueRank: -1,
                arrayDimensions: null,
                description: { text: "an Int32 argument" }
            }
        }
    ];
    structures.forEach((s, i) => {
        const dataTypeNode = addressSpace.findDataType(s.dataType);
        if (!dataTypeNode) throw new Error(`DataType ${s.dataType} not found`);
        const value = addressSpace.constructExtensionObject(dataTypeNode, s.fields);
        ctt.variable(
            `Static/All Profiles/Structures/Structure${String(i + 1).padStart(3, "0")}`,
            s.dataType,
            -1,
            new Variant({ dataType: DataType.ExtensionObject, value }),
            null
        );
    });
}

// ─── Static / DA Profile ────────────────────────────────────────────────

function addAnalogItemArrays(ctt: CttFolder): void {
    const folder = ctt.folder("Static/DA Profile/AnalogItemType Arrays");
    for (const dataTypeName of ["Double", "Float", "Int16", "Int32", "UInt16", "UInt32"]) {
        const dataType = DataType[dataTypeName as keyof typeof DataType];
        ctt.namespace.addAnalogDataItem({
            organizedBy: folder,
            browseName: dataTypeName,
            nodeId: ctt.nodeId(`Static/DA Profile/AnalogItemType Arrays/${dataTypeName}`),
            dataType: dataTypeName,
            valueRank: 1,
            arrayDimensions: [5],
            arrayType: VariantArrayType.Array,
            engineeringUnitsRange: { low: -100, high: 100 },
            instrumentRange: { low: -1000, high: 1000 },
            engineeringUnits: standardUnits.degree_celsius,
            value: new Variant({ dataType, arrayType: VariantArrayType.Array, value: buildVariantArray(dataType, 5, 0) }),
            accessLevel: readWrite,
            userAccessLevel: readWrite
        });
    }
}

function axis(addressSpace: AddressSpace, title: string, low: number, high: number) {
    const axisInformation = addressSpace.findDataType("AxisInformation");
    if (!axisInformation) throw new Error("AxisInformation not found");
    return addressSpace.constructExtensionObject(axisInformation, {
        engineeringUnits: standardUnits.second,
        euRange: { low, high },
        title: { text: title },
        axisScaleType: 0, // Linear
        axisSteps: null
    });
}

/**
 * The five ArrayItemType subtypes: plain variables of the right VariableType,
 * given the mandatory ArrayItemType properties by hand. instantiate() refuses
 * a ValueRank that differs from the type's (ImageItemType and CubeItemType
 * need 2 and 3) and namespace.addYArrayItem() ignores nodeId and organizedBy.
 */
function addArrayItems(ctt: CttFolder): void {
    const addressSpace = ctt.addressSpace;
    const namespace = ctt.namespace;
    const group = "Static/DA Profile/ArrayItemType";
    const folder = ctt.folder(group);
    const xAxis = axis(addressSpace, "x", 0, 10);
    const yAxis = axis(addressSpace, "y", 0, 20);
    const zAxis = axis(addressSpace, "z", 0, 30);
    const rangeType = addressSpace.findDataType("Range");
    const xvType = addressSpace.findDataType("XVType");
    if (!rangeType || !xvType) throw new Error("Range or XVType not found");

    const extensionObject = (value: unknown) => new Variant({ dataType: DataType.ExtensionObject, value });
    const arrayItem = (
        typeName: string,
        options: { dataType: string; valueRank: number; arrayDimensions: number[]; value: Variant },
        axes: Record<string, Variant>
    ): UAVariable => {
        const v = namespace.addVariable({
            organizedBy: folder,
            browseName: typeName,
            nodeId: ctt.nodeId(`${group}/${typeName}`),
            typeDefinition: typeName,
            dataType: options.dataType,
            valueRank: options.valueRank,
            arrayDimensions: options.arrayDimensions,
            accessLevel: readWrite,
            userAccessLevel: readWrite,
            value: options.value
        });
        const property = (browseName: string, dataType: string, value: Variant, valueRank = -1) =>
            namespace.addVariable({ propertyOf: v, browseName, dataType, valueRank, value, modellingRule: "Mandatory" });
        property("Title", "LocalizedText", new Variant({ dataType: DataType.LocalizedText, value: { text: typeName } }));
        property("AxisScaleType", "AxisScaleEnumeration", new Variant({ dataType: DataType.Int32, value: 0 }));
        property("EURange", "Range", extensionObject(addressSpace.constructExtensionObject(rangeType, { low: 0, high: 100 })));
        property(
            "InstrumentRange",
            "Range",
            extensionObject(addressSpace.constructExtensionObject(rangeType, { low: 0, high: 1000 }))
        );
        property("EngineeringUnits", "EUInformation", extensionObject(standardUnits.degree_celsius));
        for (const [name, value] of Object.entries(axes)) {
            property(name, "AxisInformation", value, value.arrayType === VariantArrayType.Array ? 1 : -1);
        }
        return v;
    };

    arrayItem(
        "YArrayItemType",
        {
            dataType: "Double",
            valueRank: 1,
            arrayDimensions: [5],
            value: new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: new Float64Array([1, 2, 3, 4, 5])
            })
        },
        { XAxisDefinition: extensionObject(xAxis) }
    );
    arrayItem(
        "XYArrayItemType",
        {
            dataType: "XVType",
            valueRank: 1,
            arrayDimensions: [3],
            value: new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [0, 1, 2].map((i) => addressSpace.constructExtensionObject(xvType, { x: i, value: i * 2 }))
            })
        },
        { XAxisDefinition: extensionObject(xAxis) }
    );
    arrayItem(
        "ImageItemType",
        {
            dataType: "UInt16",
            valueRank: 2,
            arrayDimensions: [2, 3],
            value: new Variant({
                dataType: DataType.UInt16,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: new Uint16Array([1, 2, 3, 4, 5, 6])
            })
        },
        { XAxisDefinition: extensionObject(xAxis), YAxisDefinition: extensionObject(yAxis) }
    );
    arrayItem(
        "CubeItemType",
        {
            dataType: "Double",
            valueRank: 3,
            arrayDimensions: [2, 2, 2],
            value: new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 2, 2],
                value: new Float64Array([1, 2, 3, 4, 5, 6, 7, 8])
            })
        },
        {
            XAxisDefinition: extensionObject(xAxis),
            YAxisDefinition: extensionObject(yAxis),
            ZAxisDefinition: extensionObject(zAxis)
        }
    );
    arrayItem(
        "NDimensionArrayItemType",
        {
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: [2, 3],
            value: new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: new Float64Array([1, 2, 3, 4, 5, 6])
            })
        },
        {
            AxisDefinition: new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [xAxis, yAxis]
            })
        }
    );
}

// ─── Static / HA Profile ────────────────────────────────────────────────

const HA_TYPES = [
    "Bool",
    "Byte",
    "ByteString",
    "DateTime",
    "Double",
    "Float",
    "Int16",
    "Int32",
    "Int64",
    "SByte",
    "String",
    "UInt16",
    "UInt32",
    "UInt64",
    "XmlElement"
];

/** a variable with in-memory history and a first value, so reads are Good with timestamps */
function historize(ctt: CttFolder, variable: UAVariable): UAVariable {
    ctt.addressSpace.installHistoricalDataNode(variable);
    const current = variable.readValue().value;
    variable.setValueFromSource(current);
    return variable;
}

function addHistorizingVariables(ctt: CttFolder): void {
    for (const leaf of HA_TYPES) {
        const dataTypeName = TYPE_ALIAS[leaf] ?? leaf;
        historize(ctt, ctt.typedVariable(`Static/HA Profile/Scalar/${leaf}`, dataTypeName, -1));
        historize(ctt, ctt.typedVariable(`Static/HA Profile/Arrays/${leaf}`, dataTypeName, 1));
        historize(ctt, ctt.typedVariable(`Static/HA Profile/Arrays/${leaf}2D`, dataTypeName, 2));
    }

    const range = ctt.addressSpace.findDataType("Range");
    if (!range) throw new Error("Range not found");
    historize(
        ctt,
        ctt.variable(
            "Static/HA Profile/StructureNodeSupportingHistory",
            "Range",
            -1,
            new Variant({
                dataType: DataType.ExtensionObject,
                value: ctt.addressSpace.constructExtensionObject(range, { low: 0, high: 1 })
            }),
            null
        )
    );

    // AccessLevel_* : the AccessLevel attribute; UserAccessLevel_* : the UserAccessLevel attribute
    const history = AccessLevelFlag.HistoryRead;
    const flags: Record<string, number> = {
        ReadOnly: AccessLevelFlag.CurrentRead | history,
        WriteOnly: AccessLevelFlag.CurrentWrite | history,
        None: history
    };
    for (const attribute of ["AccessLevel", "UserAccessLevel"]) {
        for (const [kind, flag] of Object.entries(flags)) {
            const relPath = `Static/HA Profile/AccessRights/${attribute}_${kind}`;
            const i = relPath.lastIndexOf("/");
            const full = AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite | history;
            const v = ctt.namespace.addVariable({
                componentOf: ctt.folder(relPath.slice(0, i)),
                browseName: relPath.slice(i + 1),
                nodeId: ctt.nodeId(relPath),
                description: `CTT setting ${relPath}`,
                dataType: "Int32",
                valueRank: -1,
                accessLevel: full,
                userAccessLevel: full,
                value: new Variant({ dataType: DataType.Int32, value: 36 })
            });
            historize(ctt, v);
            // installHistoricalDataNode() adds CurrentRead to both attributes: set the flags after it
            v.accessLevel = attribute === "AccessLevel" ? flag : full;
            v.userAccessLevel = attribute === "UserAccessLevel" ? flag : full;
        }
    }
}

// ─── entry point ────────────────────────────────────────────────────────

export function addCttFolder(namespace: Namespace, objectsFolder: UAObject): UAObject {
    const root = namespace.addFolder(objectsFolder, {
        browseName: "CTT",
        nodeId: "s=CTT",
        description: "Nodes named after the settings of the OPC Foundation Compliance Test Tool server project"
    });
    const ctt = new CttFolder(namespace, root);
    addVariantVariables(ctt);
    addBooleanScalarAndArray(ctt);
    addImageVariable(ctt);
    addStructureVariables(ctt);
    addAnalogItemArrays(ctt);
    addArrayItems(ctt);
    addHistorizingVariables(ctt);
    addAlarmInputNodes(ctt);
    return root;
}

/**
 * The node tree below `Objects/CTT`, shared by the builders that populate it.
 *
 * A CTT project generator fills a NodeId setting by browsing: the browse path
 * below `Objects/CTT` mirrors the setting path, with only the
 * "Server Test/NodeIds/" prefix stripped. So
 *   Server Test/NodeIds/Static/HA Profile/Arrays/Int162D
 * is served by
 *   Objects/CTT/Static/HA Profile/Arrays/Int162D
 * while a setting outside that prefix keeps its whole path, e.g.
 *   Server Test/Alarms and Conditions/Supported Condition Types/LimitAlarmType Input Nodes
 * is served by
 *   Objects/CTT/Server Test/Alarms and Conditions/Supported Condition Types/LimitAlarmType Input Nodes
 */
import type { AddressSpace, Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { makeAccessLevelFlag } from "node-opcua-data-model";
import { buildVariantArray, DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { typeAndDefaultValue } from "./type_defaults.js";

export const readWrite = makeAccessLevelFlag("CurrentRead | CurrentWrite");

/** setting leaf -> OPC UA DataType name */
export const TYPE_ALIAS: Record<string, string> = { Bool: "Boolean" };

function defaultValueOf(dataTypeName: string): unknown {
    const e = typeAndDefaultValue.find((t) => t.type === dataTypeName);
    if (!e) throw new Error(`no default value for ${dataTypeName}`);
    return typeof e.defaultValue === "function" ? e.defaultValue() : e.defaultValue;
}

export function variantFor(dataTypeName: string, valueRank: number): { variant: Variant; arrayDimensions: number[] | null } {
    const dataType = DataType[dataTypeName as keyof typeof DataType];
    const defaultValue = defaultValueOf(dataTypeName);
    if (valueRank === -1) {
        return {
            variant: new Variant({ dataType, arrayType: VariantArrayType.Scalar, value: defaultValue }),
            arrayDimensions: null
        };
    }
    const dimensions = valueRank === 1 ? [5] : [2, 3];
    const length = dimensions.reduce((a, b) => a * b, 1);
    return {
        variant: new Variant({
            dataType,
            arrayType: valueRank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix,
            dimensions: valueRank === 1 ? null : dimensions,
            value: buildVariantArray(dataType, length, defaultValue)
        }),
        arrayDimensions: dimensions
    };
}

export class CttFolder {
    private readonly folders = new Map<string, UAObject>();

    constructor(
        readonly namespace: Namespace,
        root: UAObject
    ) {
        this.folders.set("", root);
    }

    get addressSpace(): AddressSpace {
        return this.namespace.addressSpace as AddressSpace;
    }

    /** the folder for a setting group, created on demand, e.g. "Static/HA Profile/Arrays" */
    folder(relPath: string): UAObject {
        const existing = this.folders.get(relPath);
        if (existing) return existing;
        const i = relPath.lastIndexOf("/");
        const parent = this.folder(i < 0 ? "" : relPath.slice(0, i));
        const browseName = i < 0 ? relPath : relPath.slice(i + 1);
        const f = this.namespace.addFolder(parent, { browseName, nodeId: `s=CTT/${relPath}` });
        this.folders.set(relPath, f);
        return f;
    }

    nodeId(relPath: string): string {
        return `s=CTT/${relPath}`;
    }

    /** a plain read/write variable at the given setting path */
    variable(relPath: string, dataType: string, valueRank: number, value: Variant, arrayDimensions: number[] | null): UAVariable {
        const i = relPath.lastIndexOf("/");
        return this.namespace.addVariable({
            componentOf: this.folder(relPath.slice(0, i)),
            browseName: relPath.slice(i + 1),
            nodeId: this.nodeId(relPath),
            description: `CTT setting ${relPath}`,
            dataType,
            valueRank,
            arrayDimensions,
            accessLevel: readWrite,
            userAccessLevel: readWrite,
            value
        });
    }

    typedVariable(relPath: string, dataTypeName: string, valueRank: number): UAVariable {
        const { variant, arrayDimensions } = variantFor(dataTypeName, valueRank);
        return this.variable(relPath, dataTypeName, valueRank, variant, arrayDimensions);
    }
}

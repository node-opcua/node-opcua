/**
 * Analog data items, data items, and array analog data items for conformance testing.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { standardUnits } from "node-opcua-data-access";
import { DataType, VariantArrayType } from "node-opcua-variant";

interface RangeOptions {
    low: number;
    high: number;
}

function makeRange(dataType: DataType): { engineeringUnitsRange: RangeOptions; instrumentRange: RangeOptions } {
    let engineeringUnitsRange = { low: -200, high: 200 };
    let instrumentRange = { low: -200, high: 200 };
    if (DataType[dataType][0] === "U" || dataType === DataType.Byte) {
        engineeringUnitsRange = { low: 10, high: 250 };
        instrumentRange = { low: 10, high: 250 };
    }
    return { engineeringUnitsRange, instrumentRange };
}

export function addAnalogDataItems(namespace: Namespace, parentFolder: UAObject): void {
    function _addDataItem(localParentFolder: UAObject, dataType: DataType, initialValue: unknown): void {
        const name = `${DataType[dataType]}DataItem`;
        const nodeId = `s=${name}`;

        const v = namespace.addDataItem({
            componentOf: localParentFolder,
            nodeId,
            browseName: name,
            definition: "(tempA -25) + tempB",
            dataType,
            value: {
                arrayType: VariantArrayType.Scalar,
                dataType,
                value: initialValue
            }
        });
        assert(v.nodeId.toString() === `ns=${namespace.index};${nodeId}`, `ns=${namespace.index};${nodeId} ${v.nodeId.toString()}`);
    }

    function _addAnalogDataItem(localParentFolder: UAObject, dataType: DataType, initialValue: unknown): void {
        const { engineeringUnitsRange, instrumentRange } = makeRange(dataType);
        assert(
            Array.isArray(initialValue) ||
                ((initialValue as number) >= engineeringUnitsRange.low && (initialValue as number) <= engineeringUnitsRange.high)
        );
        const name = `${DataType[dataType]}AnalogDataItem`;
        const nodeId = `s=${name}`;

        namespace.addAnalogDataItem({
            componentOf: localParentFolder,
            nodeId,
            browseName: name,
            definition: "...",
            valuePrecision: 0.5,
            engineeringUnitsRange,
            instrumentRange,
            engineeringUnits: standardUnits.degree_celsius,
            dataType,
            value: { arrayType: VariantArrayType.Scalar, dataType, value: initialValue }
        });
    }

    function _addArrayAnalogDataItem(localParentFolder: UAObject, dataType: DataType, initialValue: unknown) {
        const name = `${DataType[dataType]}ArrayAnalogDataItem`;
        const nodeId = `s=${name}`;
        const { engineeringUnitsRange, instrumentRange } = makeRange(dataType);

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
            value: {
                arrayType: VariantArrayType.Array,
                dataType,
                value: [initialValue, initialValue, initialValue, initialValue, initialValue]
            }
        });
    }

    const analogItemFolder = namespace.addObject({
        organizedBy: parentFolder,
        browseName: "Simulation_AnalogDataItem",
        typeDefinition: "FolderType",
        nodeId: "s=Simulation_AnalogDataItem"
    });

    const { engineeringUnitsRange, instrumentRange } = makeRange(DataType.Double);
    namespace.addAnalogDataItem({
        componentOf: analogItemFolder,
        nodeId: "s=DoubleAnalogDataItemWithEU",
        browseName: "DoubleAnalogDataItemWithEU",
        definition: "(tempA -25) + tempB",
        valuePrecision: 0.5,
        engineeringUnitsRange,
        instrumentRange,
        engineeringUnits: standardUnits.degree_celsius,
        dataType: DataType.Double,
        value: { dataType: DataType.Double, value: 19.5 }
    });

    const data = [
        { dataType: DataType.Double, value: 3.14 },
        { dataType: DataType.Float, value: 3.14 },
        { dataType: DataType.Int16, value: -10 },
        { dataType: DataType.UInt16, value: 10 },
        { dataType: DataType.Int32, value: -100 },
        { dataType: DataType.UInt32, value: 100 },
        { dataType: DataType.Int64, value: [0, 0] },
        { dataType: DataType.UInt64, value: [0, 0] },
        { dataType: DataType.Byte, value: 65 },
        { dataType: DataType.SByte, value: -23 }
    ];

    for (const e of data) {
        _addAnalogDataItem(analogItemFolder, e.dataType, e.value);
    }
    for (const e of data) {
        _addDataItem(analogItemFolder, e.dataType, e.value);
    }
    _addDataItem(analogItemFolder, DataType.String, "some string");
    _addDataItem(analogItemFolder, DataType.DateTime, new Date());

    for (const e of data) {
        _addArrayAnalogDataItem(analogItemFolder, e.dataType, e.value);
    }
}

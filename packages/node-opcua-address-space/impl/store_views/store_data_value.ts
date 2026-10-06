/**
 * @module node-opcua-address-space
 *
 * DataValues built straight from the columns, for the services and the views alike: no view is
 * needed to read a node unless a getter is bound to it.
 */
import { type AttributeReader, ReadStatus, ValueKind, type ValueStore } from "node-opcua-address-space-store";
import type { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { type DataType, Variant, type VariantArrayType, type VariantOptions } from "node-opcua-variant";

/** the Value of node `i` as the columns hold it: BadWaitingForInitialData when nothing was ever set */
export function valueDataValue(values: ValueStore, i: number): DataValue {
    const kind = values.kind(i);
    if (kind === ValueKind.None) {
        const status = values.statusCode(i);
        return new DataValue({
            statusCode: status === 0 ? StatusCodes.BadWaitingForInitialData : coerceStatusCode(status)
        });
    }
    const stored = values.get(i);
    // field by field: a null-constructed Variant skips the coercion and the checks, which the
    // columns went through when the value was stored; same for the DataValue
    const variant = new Variant(null);
    if (kind === ValueKind.Object) {
        const o = stored.value as {
            dataType: DataType;
            arrayType?: VariantArrayType;
            dimensions?: number[] | null;
            value: unknown;
        };
        variant.dataType = o.dataType;
        variant.arrayType = o.arrayType ?? 0;
        variant.dimensions = o.dimensions ?? null;
        variant.value = o.value;
    } else {
        variant.dataType = stored.dataType;
        variant.arrayType = 0;
        variant.value = stored.value;
    }
    const dataValue = new DataValue(null);
    dataValue.value = variant;
    dataValue.statusCode = stored.statusCode === 0 ? StatusCodes.Good : coerceStatusCode(stored.statusCode);
    dataValue.sourceTimestamp = new Date(stored.sourceTimestamp);
    dataValue.sourcePicoseconds = stored.sourcePicoseconds;
    dataValue.serverTimestamp = new Date(stored.serverTimestamp);
    dataValue.serverPicoseconds = stored.serverPicoseconds;
    return dataValue;
}

/** an attribute other than the Value, as the attribute reader answers it */
export function attributeDataValue(reader: AttributeReader, i: number, attributeId: AttributeIds): DataValue {
    const read = reader.read(i, attributeId);
    if (read.statusCode !== ReadStatus.Good) {
        return new DataValue({ statusCode: coerceStatusCode(read.statusCode) });
    }
    const now = getCurrentClock();
    const dataValue = new DataValue(null);
    dataValue.value = new Variant({ dataType: read.dataType, arrayType: read.arrayType, value: read.value } as VariantOptions);
    dataValue.statusCode = StatusCodes.Good;
    dataValue.sourceTimestamp = read.sourceTimestamp ? new Date(read.sourceTimestamp) : now.timestamp;
    dataValue.sourcePicoseconds = read.sourcePicoseconds;
    dataValue.serverTimestamp = now.timestamp;
    dataValue.serverPicoseconds = now.picoseconds;
    return dataValue;
}

/** a status alone, stamped with the time of the denial: the value behind it undisclosed */
export function deniedDataValue(status: number): DataValue {
    const now = getCurrentClock();
    const denied = new DataValue(null);
    denied.statusCode = coerceStatusCode(status);
    denied.sourceTimestamp = now.timestamp;
    denied.sourcePicoseconds = now.picoseconds;
    denied.serverTimestamp = now.timestamp;
    denied.serverPicoseconds = now.picoseconds;
    return denied;
}

import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { DataType } from "node-opcua-variant";
import { Import, referenceEnumeration, referenceExtensionObject } from "./cache";
import { getValueRank, _convertNodeIdToDataTypeAsync } from "./utils";
import { Cache } from "./cache";

export async function getCorrepondingJavascriptType2(
    session: IBasicSession,
    nodeId: NodeId,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ dataType: DataType; jtype: string }> {
    const q = await getCorrepondingJavascriptType(session, dataTypeNodeId, cache, importCollect);
    const valueRank = await getValueRank(session, nodeId);
    return { dataType: q.dataType, jtype: q.jtype + (valueRank >= 1 ? "[]" : "") };
}

// eslint-disable-next-line complexity
export async function getCorrepondingJavascriptType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ enumerationType?: string; dataType: DataType; jtype: string }> {
    const { dataType, enumerationType } = await _convertNodeIdToDataTypeAsync(session, dataTypeNodeId);

    if (enumerationType) {
        // we have a enmeration name here
        const jtypeImport = await referenceEnumeration(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        importCollect && importCollect(jtypeImport);
        return { dataType, jtype };
    }

    if (dataType === DataType.ExtensionObject) {
        const jtypeImport = await referenceExtensionObject(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        importCollect && importCollect(jtypeImport);
        return { dataType, jtype };
    }
    const referenceBasicType = (name: string): string => {
        const t = { name, namespace: -1, module: "BasicType" };
        importCollect && importCollect(t);
        cache.ensureImported(t);
        return t.name;
    };
    
    switch (dataType) {
        case DataType.Null:
            return { dataType, jtype: "undefined" };
        case DataType.Boolean:
            return { dataType, jtype: "boolean" };
        case DataType.Byte:
            return { dataType, jtype: referenceBasicType("Byte") };
        case DataType.ByteString:
            return { dataType, jtype: "Buffer" };
        case DataType.DataValue:
            return { dataType, jtype: referenceBasicType("DataValue") };
        case DataType.DateTime:
            return { dataType, jtype: "Date" };
        case DataType.DiagnosticInfo:
            return { dataType, jtype: referenceBasicType("DiagnosticInfo") };
        case DataType.Double:
            return { dataType, jtype: "number" };
        case DataType.Float:
            return { dataType, jtype: "number" };
        case DataType.Guid:
            return { dataType, jtype: referenceBasicType("Guid") };
        case DataType.Int16:
            return { dataType, jtype: referenceBasicType("Int16") };
        case DataType.Int32:
            return { dataType, jtype: referenceBasicType("Int32") };
        case DataType.UInt16:
            return { dataType, jtype: referenceBasicType("UInt16") };
        case DataType.UInt32:
            return { dataType, jtype: referenceBasicType("UInt32") };
        case DataType.UInt64:
            return { dataType, jtype: referenceBasicType("UInt64") };
        case DataType.Int64:
            return { dataType, jtype: referenceBasicType("Int64") };
        case DataType.LocalizedText:
            return { dataType, jtype: referenceBasicType("LocalizedText") };
        case DataType.NodeId:
            return { dataType, jtype: referenceBasicType("NodeId") };
        case DataType.ExpandedNodeId:
            return { dataType, jtype: referenceBasicType("ExpandedNodeId") };
        case DataType.QualifiedName:
            return { dataType, jtype: referenceBasicType("QualifiedName") };
        case DataType.SByte:
            return { dataType, jtype: referenceBasicType("SByte") };
        case DataType.StatusCode:
            return { dataType, jtype: referenceBasicType("StatusCode") };
        case DataType.String:
            return { dataType, jtype: referenceBasicType("UAString") };
        case DataType.Variant:
            return { dataType, jtype: referenceBasicType("Variant") };
        case DataType.XmlElement:
            return { dataType, jtype: referenceBasicType("String") };
        default:
            throw new Error("Unsupported " + dataType + " " + DataType[dataType]);
    }
}

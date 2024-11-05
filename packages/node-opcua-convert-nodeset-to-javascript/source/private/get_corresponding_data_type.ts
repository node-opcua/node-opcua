import { NodeId } from "node-opcua-nodeid";
import { IBasicSessionBrowseAsyncSimple, IBasicSessionReadAsyncSimple } from "node-opcua-pseudo-session";
import { DataType } from "node-opcua-variant";
import { Import, referenceEnumeration, referenceExtensionObject } from "./cache";
import { getValueRank, _convertNodeIdToDataTypeAsync } from "./utils";
import { Cache } from "./cache";

export async function getCorrespondingJavascriptType2(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    nodeId: NodeId,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ dataType: DataType; jtype: string, dataTypeCombination?: string, type: "enum" | "basic" | "genericNumber"}> {
    const { dataType, jtype, dataTypeCombination, type} = await getCorrespondingJavascriptType(session, dataTypeNodeId, cache, importCollect);
    const valueRank = await getValueRank(session, nodeId);
    let jtype2 = "";
    if (valueRank >= 0) {
        jtype2 = jtype + "[]";
    } else if (valueRank === -1) {
        jtype2 = jtype;
    } else if (valueRank === -2) {
        //  The value can be a scalar or an array with any number of dimensions.
        jtype2 = `(${jtype} | ${jtype}[])`;
    } else if (valueRank === -3) {
        // ScalarOrOneDimension (-3):  The value can be a scalar or a one dimensional array.
        jtype2 = `(${jtype} | ${jtype}[])`;
    } else {
        throw new Error("Invalid valueRank " + valueRank);
    }
    return { dataType: dataType, jtype: jtype2, dataTypeCombination, type };
}

// eslint-disable-next-line complexity
export async function getCorrespondingJavascriptType(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ 
    enumerationType?: string; 
    dataType: DataType; 
    jtype: string,
    type: "enum" | "basic" | "genericNumber",
    dataTypeCombination?: string
 }> {

    const info = await _convertNodeIdToDataTypeAsync(session, dataTypeNodeId);
    const { type } = info;

    if (type == "enum" && info.enumerationType) {
        // we have a enmeration name here
        const jtypeImport = await referenceEnumeration(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        importCollect && importCollect(jtypeImport);
        return { dataType: info.dataType, jtype, type };
    }

    if (type == "basic" && info.dataType === DataType.ExtensionObject) {
        const jtypeImport = await referenceExtensionObject(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        importCollect && importCollect(jtypeImport);
        return { dataType: info.dataType, jtype, type };
    }
    const referenceBasicType = (name: string): string => {
        const t = { name, namespace: -1, module: "BasicType" };
        importCollect && importCollect(t);
        cache.ensureImported(t);
        return t.name;
    };
    if (type == "genericNumber") {
        const { dataTypeCombination } = info;   
        return { dataType: DataType.Variant, jtype: "number", type, dataTypeCombination };
    } else {
        const { dataType } = info;
        switch (dataType) {
            case DataType.Null:
                return { dataType: DataType.Variant, jtype: referenceBasicType("VariantOptions"), type };
            case DataType.Boolean:
                return { dataType, jtype: "boolean", type };
            case DataType.Byte:
                return { dataType, jtype: referenceBasicType("Byte"), type };
            case DataType.ByteString:
                return { dataType, jtype: "Buffer", type };
            case DataType.DataValue:
                return { dataType, jtype: referenceBasicType("DataValue"), type };
            case DataType.DateTime:
                return { dataType, jtype: "Date", type };
            case DataType.DiagnosticInfo:
                return { dataType, jtype: referenceBasicType("DiagnosticInfo"), type };
            case DataType.Double:
                return { dataType, jtype: "number", type };
            case DataType.Float:
                return { dataType, jtype: "number", type };
            case DataType.Guid:
                return { dataType, jtype: referenceBasicType("Guid"), type };
            case DataType.Int16:
                return { dataType, jtype: referenceBasicType("Int16"), type };
            case DataType.Int32:
                return { dataType, jtype: referenceBasicType("Int32"), type };
            case DataType.UInt16:
                return { dataType, jtype: referenceBasicType("UInt16"), type };
            case DataType.UInt32:
                return { dataType, jtype: referenceBasicType("UInt32"), type };
            case DataType.UInt64:
                return { dataType, jtype: referenceBasicType("UInt64"), type };
            case DataType.Int64:
                return { dataType, jtype: referenceBasicType("Int64"), type };
            case DataType.LocalizedText:
                return { dataType, jtype: referenceBasicType("LocalizedText"), type };
            case DataType.NodeId:
                return { dataType, jtype: referenceBasicType("NodeId"), type };
            case DataType.ExpandedNodeId:
                return { dataType, jtype: referenceBasicType("ExpandedNodeId"), type };
            case DataType.QualifiedName:
                return { dataType, jtype: referenceBasicType("QualifiedName"), type };
            case DataType.SByte:
                return { dataType, jtype: referenceBasicType("SByte"), type };
            case DataType.StatusCode:
                return { dataType, jtype: referenceBasicType("StatusCode"), type };
            case DataType.String:
                return { dataType, jtype: referenceBasicType("UAString"), type };
            case DataType.Variant:
                return { dataType, jtype: referenceBasicType("Variant"), type };
            case DataType.XmlElement:
                return { dataType, jtype: referenceBasicType("String"), type };
            default:
                throw new Error("Unsupported " + dataType + " " + DataType[dataType]);
        }
    }
}

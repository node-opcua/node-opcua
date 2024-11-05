import { AttributeIds, BrowseDirection, LocalizedText, NodeClass, NodeClassMask, QualifiedName } from "node-opcua-data-model";
import { INodeId, NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { DataTypeIds } from "node-opcua-constants";
import { IBasicSessionBrowseAsyncSimple, IBasicSessionReadAsyncSimple } from "node-opcua-pseudo-session";
import { BrowseResult, DataTypeDefinition, ReferenceDescription } from "node-opcua-types";
import { ModellingRuleType } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-variant";
import { make_debugLog } from "node-opcua-debug";

const debugLog = make_debugLog(__filename);

export async function getDefinition(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<DataTypeDefinition | null> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.DataTypeDefinition });
    return (dataValue.value.value as DataTypeDefinition) || null;
}
export async function getBrowseName(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<QualifiedName> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
    return dataValue.value.value as QualifiedName;
}
export async function getDataTypeNodeId(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<NodeId | null> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.DataType });
    return (dataValue.value.value as NodeId) || null;
}
export async function getIsAbstract(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<boolean> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.IsAbstract });
    return dataValue.value.value as boolean;
}
export async function getDescription(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<LocalizedText> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Description });
    return dataValue.value.value as LocalizedText;
}

export async function getNodeClass(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<NodeClass> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.NodeClass });
    return dataValue.value.value as NodeClass;
}
export async function getChildren(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription[]> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.Method | NodeClassMask.Object | NodeClass.Variable,
        nodeId,
        referenceTypeId: resolveNodeId("HasChild"),
        resultMask: 0xffff
    });
    return browseResult.references || [];
}
export async function getFolderElements(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription[]> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.Method | NodeClassMask.Object | NodeClass.Variable,
        nodeId,
        referenceTypeId: resolveNodeId("Organizes"),
        resultMask: 0xffff
    });
    return browseResult.references || [];
}

export async function getModellingRule(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ModellingRuleType | null> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.Method | NodeClassMask.Object | NodeClass.Variable,
        nodeId,
        referenceTypeId: resolveNodeId("HasModellingRule"),
        resultMask: 0xffff
    });
    if (!browseResult.references || browseResult.references.length === 0) {
        return null;
    }
    return browseResult.references[0].browseName.name! as ModellingRuleType;
}
export async function isExtensionObject(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<boolean> {
    const n = nodeId as INodeId;
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value === DataTypeIds.Structure) {
        return true;
    }
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value <= DataTypeIds.DiagnosticInfo) {
        return false;
    }
    const r = await getSubtypeNodeIdIfAny(session, nodeId);
    return await isExtensionObject(session, r!.nodeId);
}

export async function isEnumeration(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<boolean> {
    const n = nodeId as INodeId;
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value === DataTypeIds.Enumeration) {
        return true;
    }
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value <= DataTypeIds.DiagnosticInfo) {
        return false;
    }
    const r = await getSubtypeNodeIdIfAny(session, nodeId);
    return await isEnumeration(session, r!.nodeId);
}

export async function extractBasicDataType(session: IBasicSessionBrowseAsyncSimple, dataTypeNodeId: NodeId): Promise<DataType> {
    const n = dataTypeNodeId as INodeId;
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value <= DataTypeIds.DiagnosticInfo) {
        return dataTypeNodeId.value as DataType;
    }
    const r = await getSubtypeNodeIdIfAny(session, dataTypeNodeId);
    return await extractBasicDataType(session, r!.nodeId);
}

export async function getSubtypeNodeIdIfAny(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription | null> {
    if (nodeId.isEmpty()) {
        return null;
    }
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: true,
        nodeClassMask: 0, // NodeClassMask.ObjectType| NodeClass.VariableType,
        nodeId,
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 0xffff
    });
    if (!browseResult.references || browseResult.references.length === 0) {
        return null;
    }
    return browseResult.references[0];
}
export async function getSubtypeNodeId(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription> {
    const r = await getSubtypeNodeIdIfAny(session, nodeId);
    if (!r) {
        throw new Error("No Subtype");
    }
    return r;
}

export async function getTypeDefOrBaseType(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription> {
    let browseResult: BrowseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0,
        nodeId,
        referenceTypeId: resolveNodeId("HasTypeDefinition"),
        resultMask: 0xffff
    });

    if (!browseResult.references || browseResult.references.length === 0) {
        browseResult = await session.browse({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: true,
            nodeClassMask: 0,
            nodeId,
            referenceTypeId: resolveNodeId("HasSubtype"),
            resultMask: 0xffff
        });
    }
    if (!browseResult.references || browseResult.references.length === 0) {
        return new ReferenceDescription({});
    }
    return browseResult.references[0];
}
export async function getTypeDefinition(session: IBasicSessionBrowseAsyncSimple, nodeId: NodeId): Promise<ReferenceDescription> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0,
        nodeId,
        referenceTypeId: resolveNodeId("HasTypeDefinition"),
        resultMask: 0xffff
    });
    if (!browseResult.references || browseResult.references.length === 0) {
        debugLog("no subtype", nodeId.toString());
        throw new Error("No subtype");
    }
    return browseResult.references[0];
}

async function readBrowseName(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<QualifiedName> {
    const nodeToRead = {
        attributeId: AttributeIds.BrowseName,
        nodeId
    };
    const dataValue = await session.read(nodeToRead);
    // istanbul ignore next
    if (dataValue.statusCode.isNotGood()) {
        return new QualifiedName({ name: "", namespaceIndex: 0 });
    }
    const dataTypeName = dataValue.value.value;
    return dataTypeName;
}

interface DataTypeInfoBasic {
    type: "basic";
    dataType: DataType;
}
interface DataTypeInfoEnum {
    type: "enum";
    dataType: DataType.Int32;
    enumerationId: NodeId;
    enumerationType?: string;
}
interface DataTypeInfoGenericNumber {
    type: "genericNumber";
    dataTypeCombination: string;
}
type DataTypeInfo = DataTypeInfoBasic | DataTypeInfoEnum | DataTypeInfoGenericNumber;

// see also client-proxy
export async function _convertNodeIdToDataTypeAsync(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    dataTypeId: NodeId
): Promise<DataTypeInfo> {
    const dataTypeName = await readBrowseName(session, dataTypeId);

    let dataType: DataType;

    if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.Number) {
        return {
            type: "genericNumber",
            dataTypeCombination: "DataType.Float | DataType.Double | " +
                "DataType.UInt64 | DataType.UInt32 | DataType.UInt16 |  DataType.SByte | " +
                "DataType.Int64 | DataType.Int32 | DataType.Int16 | DataType.Byte"
        };
    }
    if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.Integer) {
        return {
            type: "genericNumber",
            dataTypeCombination: "DataType.Int64 | DataType.Int32 | DataType.Int16  | DataType.SByte"
        };
    }
    if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.UInteger) {
        return {
            type: "genericNumber",
            dataTypeCombination: "DataType.UInt64 | DataType.UInt32 | DataType.UInt16  | DataType.Byte"
        };
    }
    if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.Enumeration) {
        return { type: "enum", dataType: DataType.Int32, enumerationId: dataTypeId };
    }
    if (dataTypeId.namespace === 0 && DataType[dataTypeId.value as number]) {
        dataType = dataTypeId.value as DataType;
        return { type: "basic", dataType };
    }

    /// example => Duration (i=290) => Double (i=11)
    // read subTypeOf
    const nodeToBrowse = {
        browseDirection: BrowseDirection.Inverse,
        nodeId: dataTypeId,
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 0xff
    };
    // tslint:disable:no-shadowed-variable
    const browseResult = await session.browse(nodeToBrowse);

    const references = browseResult!.references;

    if (!references || references.length !== 1) {
        throw new Error("cannot find SuperType of " + dataTypeName.toString());
    }
    const nodeId = references[0].nodeId;

    const info = await _convertNodeIdToDataTypeAsync(session, nodeId);
    if (info.type == "enum" && info.enumerationId) {
        return { ...info, enumerationId: dataTypeId, enumerationType: dataTypeName.name! };
    }
    return info;
}

export async function getChildrenOrFolderElements(
    session: IBasicSessionBrowseAsyncSimple,
    nodeId: NodeId
): Promise<ReferenceDescription[]> {
    const c1 = await getChildren(session, nodeId);
    const c2 = await getFolderElements(session, nodeId);
    return (<ReferenceDescription[]>[]).concat(c1, c2);
}
export async function getValueRank(session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<number> {
    const valueRankDataValue = await session.read({ nodeId, attributeId: AttributeIds.ValueRank });
    return valueRankDataValue.value.value;
}

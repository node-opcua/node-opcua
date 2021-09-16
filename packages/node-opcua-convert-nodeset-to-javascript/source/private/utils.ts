import { AttributeIds, BrowseDirection, LocalizedText, NodeClass, NodeClassMask, QualifiedName } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { BrowseResult, DataTypeDefinition, ReferenceDescription, StructureDefinition } from "node-opcua-types";
import { ModellingRuleType } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-variant";
import { StatusCodes } from "node-opcua-status-code";

export async function getDefinition(session: IBasicSession, nodeId: NodeId): Promise<DataTypeDefinition | null> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.DataTypeDefinition });
    return (dataValue.value.value as DataTypeDefinition) || null;
}
export async function getBrowseName(session: IBasicSession, nodeId: NodeId): Promise<QualifiedName> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
    return dataValue.value.value as QualifiedName;
}
export async function getDataTypeNodeId(session: IBasicSession, nodeId: NodeId): Promise<NodeId | null> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.DataType });
    return (dataValue.value.value as NodeId) || null;
}
export async function getIsAbstract(session: IBasicSession, nodeId: NodeId): Promise<boolean> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.IsAbstract });
    return dataValue.value.value as boolean;
}
export async function getDescription(session: IBasicSession, nodeId: NodeId): Promise<LocalizedText> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Description });
    return dataValue.value.value as LocalizedText;
}

export async function getNodeClass(session: IBasicSession, nodeId: NodeId): Promise<NodeClass> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.NodeClass });
    return dataValue.value.value as NodeClass;
}
export async function getChildren(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription[]> {
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
export async function getFolderElements(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription[]> {
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

export async function getModellingRule(session: IBasicSession, nodeId: NodeId): Promise<ModellingRuleType | null> {
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
        /* 
        console.log(nodeId.toString());
        const browseName = await getBrowseName(session, nodeId);
        throw new Error("No modelling rule for " + nodeId.toString() + " " + browseName.toString());
        */
    }
    return browseResult.references[0].browseName.name! as ModellingRuleType;
}
export async function isExtensionObject(session: IBasicSession, nodeId: NodeId): Promise<boolean> {
    if (nodeId.namespace === 0 && nodeId.value === 22) {
        return true;
    }
    if (nodeId.namespace === 0 && nodeId.value <= 25) {
        return false;
    }
    const r = await getSubtypeNodeIdIfAny(session, nodeId);
    return await isExtensionObject(session, r!.nodeId);
}

export async function extractBasicDataType(session: IBasicSession, dataTypeNodeId: NodeId): Promise<DataType> {
    if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value <= 25) {
        return dataTypeNodeId.value as DataType;
    }
    const r = await getSubtypeNodeIdIfAny(session, dataTypeNodeId);
    return await extractBasicDataType(session, r!.nodeId);
}

export async function getSubtypeNodeIdIfAny(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription | null> {
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
export async function getSubtypeNodeId(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription> {
    const r = await getSubtypeNodeIdIfAny(session, nodeId);
    if (!r) {
        throw new Error("No Subtype");
    }
    return r;
}

export async function getTypeDefOrBaseType(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription> {
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
        // console.log("cannot find type definition / subtype for " + nodeId.toString());
        return new ReferenceDescription({});
    }
    return browseResult.references[0];
}
export async function getTypeDefinition(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription> {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0,
        nodeId,
        referenceTypeId: resolveNodeId("HasTypeDefinition"),
        resultMask: 0xffff
    });
    if (!browseResult.references || browseResult.references.length === 0) {
        console.log(nodeId.toString());
        throw new Error("No subtype");
    }
    return browseResult.references[0];
}

// see also client-proxy
export async function convertNodeIdToDataTypeAsync(session: IBasicSession, dataTypeId: NodeId): Promise<DataType> {
    const nodeToRead = {
        attributeId: AttributeIds.BrowseName,
        nodeId: dataTypeId
    };

    const dataValue = await session.read(nodeToRead);

    let dataType: DataType;
    // istanbul ignore next
    if (dataValue.statusCode !== StatusCodes.Good) {
        return (dataType = DataType.Null);
    }

    const dataTypeName = dataValue.value.value;

    if (dataTypeId.namespace === 0 && DataType[dataTypeId.value as number]) {
        dataType = dataTypeId.value as DataType;
        return dataType;
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
    return convertNodeIdToDataTypeAsync(session, nodeId);
}

export async function getChildrenOrFolderElements(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription[]> {
    const c1 = await getChildren(session, nodeId);
    const c2 = await getFolderElements(session, nodeId);
    return (<ReferenceDescription[]>[]).concat(c1, c2);
}
export async function getValueRank(session: IBasicSession, nodeId: NodeId): Promise<number> {
    const valueRankDataValue = await session.read({ nodeId, attributeId: AttributeIds.ValueRank });
    return valueRankDataValue.value.value;
}

import { AttributeIds, BrowseDirection, NodeClass, QualifiedName } from "node-opcua-data-model";
import { ExpandedNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { ReferenceDescription } from "node-opcua-types";

export interface ReferenceDescriptionEx extends ReferenceDescription {
    parent: ReferenceDescriptionEx;
}
export interface NodeVisitor {
    visit(reference: ReferenceDescriptionEx, level: number): Promise<void>;
}
async function _walkThroughTypes(
    session: IBasicSession,
    nodeId: NodeId,
    visitor?: NodeVisitor,
    level?: number,
    parent?: ReferenceDescription
): Promise<void> {
    level = level || 0;

    if (!parent) {

        const dataValues = await session.read([
            {nodeId, attributeId: AttributeIds.BrowseName},
            {nodeId, attributeId: AttributeIds.NodeClass},
        ])
        const browseName = dataValues[0].value.value as QualifiedName;
        const nodeClass = dataValues[1].value.value as NodeClass;
        parent = new ReferenceDescription({
            isForward: true,
            nodeId: nodeId as ExpandedNodeId, 
            browseName, 
            nodeClass,
            referenceTypeId:  resolveNodeId("HasSubtype"),
            // typeDefinition,  
        });
    }
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        nodeId,
        includeSubtypes: true,
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 0xff
    });
    for (const reference of browseResult.references || []) {
        if (visitor) {
            const r = reference as ReferenceDescriptionEx;
            r.parent = parent as ReferenceDescriptionEx;
            await visitor.visit(r, level);
        }
        await _walkThroughTypes(session, reference.nodeId, visitor, level + 1, reference);
    }
}

export async function walkThroughReferenceTypes(session: IBasicSession, nodeVisitor?: NodeVisitor) {
    const baseReferenceTypeNodeId = resolveNodeId("References");
    await _walkThroughTypes(session, baseReferenceTypeNodeId, nodeVisitor);
}
export async function walkThroughDataTypes(session: IBasicSession, nodeVisitor?: NodeVisitor) {
    const baseDataTypeTypeNodeId = resolveNodeId("BaseDataType");
    await _walkThroughTypes(session, baseDataTypeTypeNodeId, nodeVisitor);
}
export async function walkThroughInterfaceTypes(session: IBasicSession, nodeVisitor?: NodeVisitor) {
    const baseInterfaceTypeNodeId = resolveNodeId("BaseInterfaceType");
    await _walkThroughTypes(session, baseInterfaceTypeNodeId, nodeVisitor);
}
export async function walkThroughObjectTypes(session: IBasicSession, nodeVisitor?: NodeVisitor) {
    const baseObjectType = resolveNodeId("BaseObjectType");
    await _walkThroughTypes(session, baseObjectType, nodeVisitor);
}
export async function walkThroughVariableTypes(session: IBasicSession, nodeVisitor?: NodeVisitor) {
    const baseObjectType = resolveNodeId("BaseVariableType");
    await _walkThroughTypes(session, baseObjectType, nodeVisitor);
}

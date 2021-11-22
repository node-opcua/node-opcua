import { BrowseDirection, makeNodeClassMask, makeResultMask } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, BrowseDescriptionLike, browseAll } from "node-opcua-pseudo-session";
import { DataTypeAndEncodingId } from "node-opcua-schemas";

export async function _findEncodings(session: IBasicSession, dataTypeNodeId: NodeId): Promise<DataTypeAndEncodingId> {
    const nodeToBrowse: BrowseDescriptionLike = {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: makeNodeClassMask("Object"),
        nodeId: dataTypeNodeId,
        referenceTypeId: resolveNodeId("HasEncoding"),
        resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
    };
    const result = await browseAll(session, nodeToBrowse);
    const references = result.references || [];
    if (references.length === 0) {
        // xx throw new Error("Cannot find encodings on type " + dataTypeNodeId.toString() + " statusCode " + result.statusCode.toString());
    }
    const encodings: DataTypeAndEncodingId = {
        dataTypeNodeId,

        binaryEncodingNodeId: new NodeId(),
        jsonEncodingNodeId: new NodeId(),
        xmlEncodingNodeId: new NodeId()
    };
    for (const ref of references) {
        switch (ref.browseName.name) {
            case "Default Binary":
                encodings.binaryEncodingNodeId = ref.nodeId;
                break;
            case "Default XML":
                encodings.xmlEncodingNodeId = ref.nodeId;
                break;
            case "Default JSON":
                encodings.jsonEncodingNodeId = ref.nodeId;
                break;
            default:
                console.log(" ignoring encoding ", ref.browseName.toString());
        }
    }
    return encodings;
}

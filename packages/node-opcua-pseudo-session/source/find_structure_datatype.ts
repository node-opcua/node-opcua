import { DataTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClassMask } from "node-opcua-data-model";
import { NodeId, coerceNodeId } from "node-opcua-nodeid";
import {  IBasicSessionBrowseAsyncSimple, IBasicSessionBrowseNextAsyncSimple } from "./basic_session_interface";

export async function findStructureDataType(
    session: IBasicSessionBrowseAsyncSimple & IBasicSessionBrowseNextAsyncSimple,
    dataTypeName: string,
    namespaceIndex: number
): Promise<NodeId | null> {
    let results = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        referenceTypeId: "HasSubtype",
        resultMask: 0xff,
        nodeId: coerceNodeId(DataTypeIds.Structure)
    });
    if (results.statusCode.isNotGood() || !results.references) {
        return null;
    }
    const ref = results.references.find(
        (r) => r.browseName.name === dataTypeName && r.browseName.namespaceIndex === namespaceIndex
    );
    if (ref) {
        return ref.nodeId;
    }
    while (results.continuationPoint) {
        results = await session.browseNext(results.continuationPoint, false);
        if (results.statusCode.isNotGood() || !results.references) {
            return null;
        }
        const ref = results.references.find(
            (r) => r.browseName.name === dataTypeName && r.browseName.namespaceIndex === namespaceIndex
        );
        if (ref) {
            if (results.continuationPoint) {
                await session.browseNext(results.continuationPoint, true);
            }
            return ref.nodeId;
        }
    }
    return null;
}

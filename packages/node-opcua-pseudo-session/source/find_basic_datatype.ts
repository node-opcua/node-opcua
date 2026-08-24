import { DataTypeIds, ReferenceTypeIds } from "node-opcua-constants";
import { makeResultMask } from "node-opcua-data-model";
import { makeNodeId, type NodeId, NodeIdType } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDirection } from "node-opcua-service-browse";
import { DataType } from "node-opcua-variant";
import type { IBasicSessionBrowseAsyncSimple } from "./basic_session_interface";

const resultMask = makeResultMask("ReferenceType");

const hasSubtypeNodeId = makeNodeId(ReferenceTypeIds.HasSubtype);

export async function findSuperType(session: IBasicSessionBrowseAsyncSimple, dataTypeId: NodeId): Promise<NodeId> {
    // let's browse for the SuperType of this object
    const nodeToBrowse = new BrowseDescription({
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeId: dataTypeId,
        referenceTypeId: hasSubtypeNodeId,
        resultMask
    });
    const browseResult = await session.browse(nodeToBrowse);
    browseResult.references = browseResult.references || /* c8 ignore next */ [];
    const baseDataType = browseResult.references[0].nodeId;
    return baseDataType;
}

export async function findBasicDataType(session: IBasicSessionBrowseAsyncSimple, dataTypeId: NodeId): Promise<DataType> {
    if (dataTypeId.identifierType === NodeIdType.NUMERIC && dataTypeId.value === DataTypeIds.Enumeration) {
        // see https://reference.opcfoundation.org/v104/Core/docs/Part3/8.40/
        return DataType.Int32;
    }
    if (dataTypeId.identifierType === NodeIdType.NUMERIC && (dataTypeId.value as number) <= DataType.DiagnosticInfo) {
        // we have a well-known DataType
        return dataTypeId.value as DataType;
    } else {
        const baseDataTypeId = await findSuperType(session, dataTypeId);
        return await findBasicDataType(session, baseDataTypeId);
    }
}

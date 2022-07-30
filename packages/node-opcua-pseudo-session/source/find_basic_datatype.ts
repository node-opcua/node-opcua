import { makeNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDirection, BrowseResult } from "node-opcua-service-browse";
import { DataType } from "node-opcua-variant";
import { ReferenceTypeIds, DataTypeIds } from "node-opcua-constants";
import { makeResultMask } from "node-opcua-data-model";
import { IBasicSession } from "./basic_session_interface";

const resultMask = makeResultMask("ReferenceType");

const hasSubtypeNodeId = makeNodeId(ReferenceTypeIds.HasSubtype);

export function findSuperType(session: IBasicSession, dataTypeId: NodeId): Promise<NodeId>;
export function findSuperType(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, baseDataTypeId?: NodeId) => void
): void;
export function findSuperType(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback?: (err: Error | null, baseDataTypeId?: NodeId) => void
): any {
    // let's browse for the SuperType of this object
    const nodeToBrowse = new BrowseDescription({
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeId: dataTypeId,
        referenceTypeId: hasSubtypeNodeId,
        resultMask
    });

    session.browse(nodeToBrowse, (err: Error | null, browseResult?: BrowseResult) => {
        /* istanbul ignore next */
        if (err) {
            return callback!(err);
        }

        /* istanbul ignore next */
        if (!browseResult) {
            return callback!(new Error("Internal Error"));
        }

        browseResult.references = browseResult.references || /* istanbul ignore next */ [];
        const baseDataType = browseResult.references[0].nodeId;
        callback!(null, baseDataType);
    });
}

export function findBasicDataType(session: IBasicSession, dataTypeId: NodeId): Promise<DataType>;
export function findBasicDataType(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
): void;
export function findBasicDataType(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback?: (err: Error | null, dataType?: DataType) => void
): any {
    if (dataTypeId.identifierType === NodeIdType.NUMERIC && dataTypeId.value === DataTypeIds.Enumeration) {
        // see https://reference.opcfoundation.org/v104/Core/docs/Part3/8.40/
        return callback!(null, DataType.Int32);
    }

    if (dataTypeId.identifierType === NodeIdType.NUMERIC && dataTypeId.value <= DataType.DiagnosticInfo) {
        // we have a well-known DataType
        const dataTypeName = DataType[dataTypeId.value as number];
        callback!(null, dataTypeId.value as DataType);
    } else {
        findSuperType(session, dataTypeId, (err: Error | null, baseDataTypeId?: NodeId) => {
            if (err) {
                return callback!(err);
            }
            findBasicDataType(session, baseDataTypeId!, callback!);
        });
    }
}

const thenify = require("thenify");
exports.findBasicDataType = thenify.withCallback(exports.findBasicDataType);
exports.findSuperType = thenify.withCallback(exports.findSuperType);
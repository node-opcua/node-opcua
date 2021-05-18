import { makeNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDirection, BrowseResult } from "node-opcua-service-browse";
import { DataType } from "node-opcua-variant";
import { IBasicSession } from "./basic_session_interface";
import { ReferenceTypeIds } from "node-opcua-constants";
import { AttributeIds, makeResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";



const resultMask = makeResultMask("ReferenceType");

export function findBasicDataType(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
) {
    if (dataTypeId.identifierType === NodeIdType.NUMERIC && dataTypeId.value <= 25) {
        // we have a well-known DataType
        const dataTypeName = DataType[dataTypeId.value as number];
        callback(null, dataTypeId.value as DataType);
    } else {
        // let's browse for the SuperType of this object
        const nodeToBrowse = new BrowseDescription({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeId: dataTypeId,
            referenceTypeId: makeNodeId(ReferenceTypeIds.HasSubtype),
            resultMask
        });

        session.browse(nodeToBrowse, (err: Error | null, browseResult?: BrowseResult) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }

            /* istanbul ignore next */
            if (!browseResult) {
                return callback(new Error("Internal Error"));
            }

            browseResult.references = browseResult.references || /* istanbul ignore next */[];
            const baseDataType = browseResult.references[0].nodeId;
            return findBasicDataType(session, baseDataType, callback);
        });
    }
}


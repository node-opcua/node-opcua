import { ObjectIds } from "node-opcua-constants";
import { BaseUAObject, buildStructuredType, type IStructuredTypeSchema } from "node-opcua-factory";
import { makeExpandedNodeId } from "node-opcua-nodeid";

import { RequestHeader } from "node-opcua-service-secure-channel";

// a fake request type that is supposed to be correctly decoded on server side
// but that is not supported by the server engine

const schemaServerSideUnimplementedRequest = buildStructuredType({
    name: "ServerSideUnimplementedRequest",
    baseType: "BaseUAObject",
    //x    id: ObjectIds.Annotation_Encoding_DefaultXml,
    fields: [{ name: "RequestHeader", fieldType: "RequestHeader" }]
});

export class ServerSideUnimplementedRequest extends BaseUAObject {
    static schema: IStructuredTypeSchema;
    requestHeader: RequestHeader;
    constructor(_options: Record<string, never>) {
        super();
        this.requestHeader = new RequestHeader();
    }
    get schema() /*: IStructuredTypeSchema */ {
        return schemaServerSideUnimplementedRequest;
    }
}
ServerSideUnimplementedRequest.schema = schemaServerSideUnimplementedRequest;
ServerSideUnimplementedRequest.schema.encodingDefaultBinary = makeExpandedNodeId(ObjectIds.Annotation_Encoding_DefaultXml, 0);
ServerSideUnimplementedRequest.schema.encodingDefaultXml = makeExpandedNodeId(ObjectIds.Annotation_Encoding_DefaultBinary, 0);

import {
    BaseUAObject,
    buildStructuredType
} from "node-opcua-factory";

import {
    makeExpandedNodeId
} from "node-opcua-nodeid";

import {
    ObjectIds
} from "node-opcua-constants";

import {
    RequestHeader
} from "node-opcua-service-secure-channel";
// a fake request type that is supposed to be correctly decoded on server side
// but that is not supported by the server engine

const schemaServerSideUnimplementedRequest = buildStructuredType({
    name: "ServerSideUnimplementedRequest",
    baseType: "BaseUAObject",
//x    id: ObjectIds.Annotation_Encoding_DefaultXml,
    fields: [
        {name: "RequestHeader", fieldType: "RequestHeader"}
    ]
});

export class ServerSideUnimplementedRequest extends  BaseUAObject
{

    static schema: any;
    requestHeader: RequestHeader;
    constructor(options: {} ) {
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

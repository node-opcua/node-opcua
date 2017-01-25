// a fake request type that is supposed to be correctly decoded on server side
// but that is not supported by the server engine
var ObjectIds = require("lib/opcua_node_ids").ObjectIds;

const ServerSideUnimplementedRequest_Schema = {
    name: "ServerSideUnimplementedRequest",
    id: ObjectIds.Annotation_Encoding_DefaultXml,
    fields: [
        {name: "requestHeader", fieldType: "RequestHeader"}
    ]
};

export { ServerSideUnimplementedRequest_Schema };

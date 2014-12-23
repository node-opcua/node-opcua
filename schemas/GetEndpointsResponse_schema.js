
var GetEndpointsResponse_Schema = {
    name: "GetEndpointsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"       },
        { name: "endpoints", isArray: true, fieldType: "EndpointDescription"  }
    ]
};

exports.GetEndpointsResponse_Schema = GetEndpointsResponse_Schema;
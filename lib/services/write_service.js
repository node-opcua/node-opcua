var factories = require("./../misc/factories");

var WriteValue_Schema = {
    name: "WriteValue",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId"}, // see AttributeIds
        { name: "indexRange" ,   fieldType: "NumericRange"    , defaultValue: function() { return null; }},
        { name: "value",         fieldType: "DataValue"}
    ]
};
exports.WriteValue = factories.registerObject(WriteValue_Schema);

var WriteRequest_Schema = {
    name: "WriteRequest",
    fields: [
        { name: "requestHeader" ,               fieldType: "RequestHeader"},
        { name: "nodesToWrite", isArray:true,   fieldType: "WriteValue" }
    ]
};
exports.WriteRequest = factories.registerObject(WriteRequest_Schema);

var WriteResponse_Schema = {
    name: "WriteResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader" },
        { name: "results",         isArray:true,  fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};
exports.WriteResponse = factories.registerObject(WriteResponse_Schema);

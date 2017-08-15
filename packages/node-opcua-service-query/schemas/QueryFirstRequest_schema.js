require("node-opcua-service-secure-channel");
require("node-opcua-service-browse"); // for ViewDescription
require("node-opcua-service-filter"); // ContentFilter

var QueryFirstRequest_Schema = {
    name: "QueryFirstRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"view",                        fieldType:"ViewDescription"},
        { name:"nodeTypes",      isArray:true,fieldType:"NodeTypeDescription"},
        { name:"filter",                      fieldType:"ContentFilter"},
        { name:"maxDataSetsToReturn",         fieldType:"Counter"},
        { name:"maxReferencesToReturn",       fieldType:"Counter"}
    ]
};
exports.QueryFirstRequest_Schema = QueryFirstRequest_Schema;

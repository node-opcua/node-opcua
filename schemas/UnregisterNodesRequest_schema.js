

var UnregisterNodesRequest_Schema = {
    documentation:"Registers Nodes",
    name: "UnregisterNodesRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"nodesToUnregister",isArray:true,fieldType:"NodeId", documentation: "A list of NodeIds that have been obtained via the RegisterNodes service."}
    ]
};
exports.UnregisterNodesRequest_Schema = UnregisterNodesRequest_Schema;

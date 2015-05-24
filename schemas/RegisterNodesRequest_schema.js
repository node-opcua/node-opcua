

var RegisterNodesRequest_Schema = {
    documentation:"Registers Nodes",
    name: "RegisterNodesRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"nodesToRegister",isArray:true,fieldType:"NodeId", documentation: "List of NodeIds to register that the client has retrieved through browsing, querying or in some other manner"}
    ]
};
exports.RegisterNodesRequest_Schema = RegisterNodesRequest_Schema;

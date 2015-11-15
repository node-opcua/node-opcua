var AddNodesRequest_Schema = {
    name:"AddNodesRequest",
    fields: [
        { name:"requestHeader",  fieldType:"RequestHeader", documentation:"A standard header included in all requests sent to a server." },
        { name: "nodesToAdd",    fieldType: "AddNodesItem", isArray: true, documentation: " "}
    ]
};
exports.AddNodesRequest_Schema =AddNodesRequest_Schema;




var DeleteNodesRequest_Schema = {
    name:"DeleteNodesRequest",
    fields: [
        { name:"requestHeader",  fieldType:"RequestHeader", documentation:"A standard header included in all requests sent to a server." },
        { name: "nodesToDelete",    fieldType: "DeleteNodesItem", isArray: true, documentation: " "}
    ]
};
exports.DeleteNodesRequest_Schema =DeleteNodesRequest_Schema;




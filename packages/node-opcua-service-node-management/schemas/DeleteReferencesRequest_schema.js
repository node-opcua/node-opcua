require("node-opcua-service-secure-channel");

var DeleteReferencesRequest_Schema = {
    name:"DeleteReferencesRequest",
    fields: [
        { name:"requestHeader",  fieldType:"RequestHeader", documentation:"A standard header included in all requests sent to a server." },
        { name: "referencesToDelete",    fieldType: "DeleteReferencesItem", isArray: true, documentation: " "}
    ]
};
exports.DeleteReferencesRequest_Schema =DeleteReferencesRequest_Schema;




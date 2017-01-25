const AddReferencesRequest_Schema = {
    name:"AddReferencesRequest",
    fields: [
        { name: "requestHeader",   fieldType: "RequestHeader",     documentation:"A standard header included in all requests sent to a server." },
        { name: "referencesToAdd", fieldType: "AddReferencesItem", isArray: true, documentation: " "}
    ]
};
export {AddReferencesRequest_Schema};




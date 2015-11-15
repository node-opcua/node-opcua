
var AddReferencesResponse_Schema = {
    name:"AddReferencesResponse",
    fields: [
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},
        {name: "results",     fieldType: "StatusCode",  isArray: true, documentation: " "},
        {name: "diagnostics", fieldType: "DiagnosticInfo",  isArray: true, documentation: " "}
    ]
};
exports.AddReferencesResponse_Schema =AddReferencesResponse_Schema;
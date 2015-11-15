
var DeleteNodesResponse_Schema = {
    name:"DeleteNodesResponse",
    fields: [
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},
        {name: "results",     fieldType: "StatusCode",  isArray: true, documentation: " "},
        {name: "diagnostics", fieldType: "DiagnosticInfo",  isArray: true, documentation: " "}
    ]
};
exports.DeleteNodesResponse_Schema =DeleteNodesResponse_Schema;
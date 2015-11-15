
var AddNodesResponse_Schema = {
    name:"AddNodesResponse",
    fields: [
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},
        {name: "results",     fieldType: "AddNodesResult",  isArray: true, documentation: " "},
        {name: "diagnostics", fieldType: "DiagnosticInfo",  isArray: true, documentation: " "}
    ]
};
exports.AddNodesResponse_Schema =AddNodesResponse_Schema;
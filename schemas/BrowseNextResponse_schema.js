var BrowseNextResponse_Schema = {
    name: "BrowseNextResponse",
    documentation: "Browse the references for one or more nodes from the server address space.",
    fields: [
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},
        {name: "results", isArray: true, fieldType: "BrowseResult", documentation: "The results for the browse operations." },
        {name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo", documentation: "The diagnostics associated with the results."}
    ]
};
exports.BrowseNextResponse_Schema = BrowseNextResponse_Schema;


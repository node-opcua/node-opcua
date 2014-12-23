
var TranslateBrowsePathsToNodeIdsResponse_Schema = {
    name: "TranslateBrowsePathsToNodeIdsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "BrowsePathResult", documentation: "The results for the translate operations." },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo", documentation: "The diagnostics associated with the results." }
    ]
};
exports.TranslateBrowsePathsToNodeIdsResponse_Schema = TranslateBrowsePathsToNodeIdsResponse_Schema;

var ContentFilterResult_Schema = {
    name: "ContentFilterResult",
    fields: [
        { name: "elementResults", isArray: true, fieldType: "ContentFilterElementResult" },
        { name: "elementDiagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.ContentFilterResult_Schema = ContentFilterResult_Schema;

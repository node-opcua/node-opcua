var HistoryReadResponse_Schema = {
    name: "HistoryReadResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"},
        { name: "results", isArray: true, fieldType: "HistoryReadResult" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.HistoryReadResponse_Schema = HistoryReadResponse_Schema;

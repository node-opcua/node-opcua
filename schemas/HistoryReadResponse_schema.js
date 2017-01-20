const HistoryReadResponse_Schema = {
    name: "HistoryReadResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"},
        { name: "results", isArray: true, fieldType: "HistoryReadResult" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
export {HistoryReadResponse_Schema};

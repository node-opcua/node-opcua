var HistoryUpdateResponse_Schema = {
    name: "HistoryUpdateResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"},
    /**
     * List of update results for the history update details. The size and order of the list matches the size and
     * order of the details element of the historyUpdateDetails parameter specified in the request. This structure
     * is defined in-line with the following indented items.
     */
        { name: "results", isArray: true, fieldType: "HistoryUpdateResult" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.HistoryUpdateResponse_Schema = HistoryUpdateResponse_Schema;

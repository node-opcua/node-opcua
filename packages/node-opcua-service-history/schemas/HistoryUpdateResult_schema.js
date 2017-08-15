
var HistoryUpdateResult_Schema = {
    name: "HistoryUpdateResult",
    fields: [
    /*=
     * StatusCode for the update of the Node (see 7.34 for StatusCode definition).
     */
        { name: "statusCode",                     fieldType: "StatusCode" },
    /*=
     * List of StatusCodes for the operations to be performed on a Node. The size and order of the list matches the
     * size and order of any list defined by the details element being reported by this result entry.
     */
        { name: "operationResults",   isArray:true,          fieldType: "StatusCode"},
    /**
     * @class HistoryUpdateResult
     *
     * @property diagnosticInfos
     * @type DiagnosticInfo[]Ò
     *
     * List of diagnostic information for the operations to be performed on a Node.
     *
     * The size and order of the list matches the size and order of any list defined by the details element being
     * reported by this updateResults entry. This list is empty if diagnostics information was not requested in the
     * request header or if no diagnostic information was encountered in processing of the request.
     *
     */
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.HistoryUpdateResult_Schema = HistoryUpdateResult_Schema;
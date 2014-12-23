
var DeleteMonitoredItemsResponse_Schema = {
    name: "DeleteMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DeleteMonitoredItemsResponse_Schema = DeleteMonitoredItemsResponse_Schema;

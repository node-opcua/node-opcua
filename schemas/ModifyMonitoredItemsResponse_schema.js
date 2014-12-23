var ModifyMonitoredItemsResponse_Schema = {
    name: "ModifyMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.ModifyMonitoredItemsResponse_Schema = ModifyMonitoredItemsResponse_Schema;

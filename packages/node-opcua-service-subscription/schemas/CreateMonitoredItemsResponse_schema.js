
var CreateMonitoredItemsResponse_Schema = {
    name: "CreateMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "MonitoredItemCreateResult" },
        { name: "diagnosticInfos", isArray:true,  fieldType:"DiagnosticInfo" }
    ]
};
exports.CreateMonitoredItemsResponse_Schema = CreateMonitoredItemsResponse_Schema;


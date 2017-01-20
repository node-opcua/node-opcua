
const DeleteMonitoredItemsResponse_Schema = {
    name: "DeleteMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
export {DeleteMonitoredItemsResponse_Schema};

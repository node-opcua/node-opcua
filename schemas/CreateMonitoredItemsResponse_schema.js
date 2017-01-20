
const CreateMonitoredItemsResponse_Schema = {
    name: "CreateMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "MonitoredItemCreateResult" },
        { name: "diagnosticInfos", isArray:true,  fieldType:"DiagnosticInfo" }
    ]
};
export {CreateMonitoredItemsResponse_Schema};


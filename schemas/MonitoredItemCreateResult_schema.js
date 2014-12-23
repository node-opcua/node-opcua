
var MonitoredItemCreateResult_Schema = {
    name: "MonitoredItemCreateResult",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "monitoredItemId", fieldType: "IntegerId" },
        { name: "revisedSamplingInterval", fieldType: "Duration" },
        { name: "revisedQueueSize", fieldType: "Counter" },
        { name: "filterResult", fieldType: "ExtensionObject" }
    ]
};
exports.MonitoredItemCreateResult_Schema = MonitoredItemCreateResult_Schema;
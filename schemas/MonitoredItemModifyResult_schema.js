var MonitoredItemModifyResult_Schema = {
    name: "MonitoredItemModifyResult",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "revisedSamplingInterval", fieldType: "Duration" },
        { name: "revisedQueueSize", fieldType: "Counter" },
        { name: "filterResult", fieldType: "ExtensionObject" }
    ]
};
exports.MonitoredItemModifyResult_Schema = MonitoredItemModifyResult_Schema;

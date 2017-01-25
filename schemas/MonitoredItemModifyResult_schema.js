const MonitoredItemModifyResult_Schema = {
    name: "MonitoredItemModifyResult",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "revisedSamplingInterval", fieldType: "Duration" },
        { name: "revisedQueueSize", fieldType: "Counter" },
        { name: "filterResult", fieldType: "ExtensionObject" }
    ]
};
export {MonitoredItemModifyResult_Schema};

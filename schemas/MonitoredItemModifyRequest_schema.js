
var MonitoredItemModifyRequest_Schema = {
    name: "MonitoredItemModifyRequest",
    fields: [
        { name: "monitoredItemId", fieldType: "IntegerId" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
exports.MonitoredItemModifyRequest_Schema = MonitoredItemModifyRequest_Schema;
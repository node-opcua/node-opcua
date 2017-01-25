
const MonitoredItemModifyRequest_Schema = {
    name: "MonitoredItemModifyRequest",
    fields: [
        { name: "monitoredItemId", fieldType: "IntegerId" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
export {MonitoredItemModifyRequest_Schema};
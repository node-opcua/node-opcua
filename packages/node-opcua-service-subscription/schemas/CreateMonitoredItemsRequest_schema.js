var CreateMonitoredItemsRequest_Schema = {
    name: "CreateMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "timestampsToReturn", fieldType: "TimestampsToReturn" },
        { name: "itemsToCreate", isArray: true, fieldType: "MonitoredItemCreateRequest" }
    ]
};
exports.CreateMonitoredItemsRequest_Schema = CreateMonitoredItemsRequest_Schema;

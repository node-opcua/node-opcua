
const ModifyMonitoredItemsRequest_Schema = {
    name: "ModifyMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "timestampsToReturn", fieldType: "TimestampsToReturn" },
        { name: "itemsToModify", isArray: true, fieldType: "MonitoredItemModifyRequest" }
    ]
};
export {ModifyMonitoredItemsRequest_Schema};
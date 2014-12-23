

var DeleteMonitoredItemsRequest_Schema = {
    name: "DeleteMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "monitoredItemIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.DeleteMonitoredItemsRequest_Schema = DeleteMonitoredItemsRequest_Schema;

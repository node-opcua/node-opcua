var ModifySubscriptionRequest_Schema = {
    name: "ModifySubscriptionRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "requestedPublishingInterval", fieldType: "Duration" },
        { name: "requestedLifetimeCount", fieldType: "Counter" },
        { name: "requestedMaxKeepAliveCount", fieldType: "Counter" },
        { name: "maxNotificationsPerPublish", fieldType: "Counter" },
        { name: "priority", fieldType: "Byte" }
    ]
};
exports.ModifySubscriptionRequest_Schema = ModifySubscriptionRequest_Schema;

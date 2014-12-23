var CreateSubscriptionResponse_Schema = {
    name: "CreateSubscriptionResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "revisedPublishingInterval", fieldType: "Duration" },
        { name: "revisedLifetimeCount", fieldType: "Counter" },
        { name: "revisedMaxKeepAliveCount", fieldType: "Counter" }
    ]
};
exports.CreateSubscriptionResponse_Schema = CreateSubscriptionResponse_Schema;



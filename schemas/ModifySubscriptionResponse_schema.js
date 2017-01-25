
const ModifySubscriptionResponse_Schema = {
    name: "ModifySubscriptionResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "revisedPublishingInterval", fieldType: "Duration" },
        { name: "revisedLifetimeCount", fieldType: "Counter" },
        { name: "revisedMaxKeepAliveCount", fieldType: "Counter" }
    ]
};
export {ModifySubscriptionResponse_Schema};


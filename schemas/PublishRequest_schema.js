
const PublishRequest_Schema = {
    name: "PublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionAcknowledgements", isArray: true, fieldType: "SubscriptionAcknowledgement" }
    ]
};
export {PublishRequest_Schema};


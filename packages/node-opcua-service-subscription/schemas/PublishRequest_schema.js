
var PublishRequest_Schema = {
    name: "PublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionAcknowledgements", isArray: true, fieldType: "SubscriptionAcknowledgement" }
    ]
};
exports.PublishRequest_Schema = PublishRequest_Schema;


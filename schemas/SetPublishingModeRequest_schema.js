
var SetPublishingModeRequest_Schema = {
    name: "SetPublishingModeRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "publishingEnabled", fieldType: "Boolean" },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.SetPublishingModeRequest_Schema = SetPublishingModeRequest_Schema;
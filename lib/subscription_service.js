var factories = require("./factories");

var CreateSubscriptionRequest_Schema = {
    name: "CreateSubscriptionRequest",
    fields: [
        { name: "requestHeader" ,              fieldType:"RequestHeader" },
        { name: "requestedPublishingInterval", fieldType:"Duration"},
        { name: "requestedLifetimeCount",      fieldType:"Counter"},
        { name: "requestedMaxKeepAliveCount",  fieldType:"Counter"},
        { name: "maxNotificationsPerPublish",  fieldType:"Counter"},
        { name: "publishingEnabled",           fieldType:"Boolean"},
        { name: "priority",                    fieldType:"Byte"}
    ]
};
exports.CreateSubscriptionRequest = factories.registerObject(CreateSubscriptionRequest_Schema);


var CreateSubscriptionResponse_Schema = {
    name: "CreateSubscriptionResponse",
    fields: [
        { name: "responseHeader",              fieldType:"ResponseHeader" },
        { name: "subscriptionId",              fieldType:"IntegerId" },
        { name: "revisedPublishingInterval",   fieldType:"Duration" },
        { name: "revisedLifetimeCount",        fieldType:"Counter" },
        { name: "revisedMaxKeepAliveCount",    fieldType:"Counter" }
    ]
};
exports.CreateSubscriptionResponse = factories.registerObject(CreateSubscriptionResponse_Schema);


var ModifySubscriptionRequest_Schema = {
    name: "ModifySubscriptionRequest",
    fields: [
        { name: "requestHeader" ,              fieldType:"RequestHeader" },
        { name: "subscriptionId",              fieldType:"IntegerId" },
        { name: "requestedPublishingInterval", fieldType:"Duration" },
        { name: "requestedLifetimeCount",      fieldType:"Counter" },
        { name: "requestedMaxKeepAliveCount",  fieldType:"Counter" },
        { name: "maxNotificationsPerPublish",  fieldType:"Counter" },
        { name: "priority",                    fieldType:"Byte" }
    ]
};
exports.ModifySubscriptionRequest = factories.registerObject(ModifySubscriptionRequest_Schema);

var ModifySubscriptionResponse_Schema = {
    name: "ModifySubscriptionResponse",
    fields: [
        { name: "responseHeader" ,              fieldType:"ResponseHeader" },
        { name: "revisedPublishingInterval",    fieldType:"Duration" },
        { name: "revisedLifetimeCount",         fieldType:"Counter" },
        { name: "revisedMaxKeepAliveCount",     fieldType:"Counter" }
    ]
};
exports.ModifySubscriptionResponse = factories.registerObject(ModifySubscriptionResponse_Schema);


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


var CreateMonitoredItemsRequest_Schema = {
    name: "CreateMonitoredItemsRequest",
    fields: [
        { name: "requestHeader" ,                   fieldType:"RequestHeader" },
        { name: "subscriptionId" ,                  fieldType:"IntegerId" },
        { name: "timestampsToReturn" ,              fieldType:"TimestampsToReturn" },
        { name: "itemsToCreate" ,    isArray:true,  fieldType:"MonitoredItemCreateRequest" }
    ]
};
exports.CreateMonitoredItemsRequest = factories.registerObject(CreateMonitoredItemsRequest_Schema);

var CreateMonitoredItemsResponse_Schema = {
    name: "CreateMonitoredItemsResponse",
    fields: [
        { name: "responseHeader" ,                fieldType:"ResponseHeader" },
        { name: "diagnosticInfos", isArray:true,  fieldType:"DiagnosticInfo" }
    ]
};
exports.CreateMonitoredItemsResponse = factories.registerObject(CreateMonitoredItemsResponse_Schema);

var MonitoringMode_Schema = {
    name: "MonitoringMode",
    isEnum: true,
    enumValues: {
        Disabled:          0,
        Sampling:          1,
        Reporting:         2
     }
};
exports.MonitoringMode = factories.registerObject(MonitoringMode_Schema);


var MonitoredItemCreateRequest_Schema = {
    name: "MonitoredItemCreateRequest",
    fields: [
        { name: "itemToMonitor" ,                fieldType:"ReadValueId" },
        { name: "monitoringMode",                fieldType:"MonitoringMode" },
        { name: "requestedParameters",           fieldType:"MonitoringParameters" }
    ]
};
exports.MonitoredItemCreateRequest = factories.registerObject(MonitoredItemCreateRequest_Schema);

var MonitoredItemCreateResult_Schema = {
    name: "MonitoredItemCreateResult",
    fields: [
        { name: "statusCode" ,                    fieldType:"StatusCode" },
        { name: "monitoredItemId",                fieldType:"IntegerId" },
        { name: "revisedSamplingInterval",        fieldType:"Duration" },
        { name: "revisedQueueSize",               fieldType:"Counter" },
        { name: "filterResult",                   fieldType:"ExtensionObject" }
    ]
};
exports.MonitoredItemCreateResult = factories.registerObject(MonitoredItemCreateResult_Schema);


var MonitoringParameters_Schema = {
    name: "MonitoringParameters",
    fields: [
        { name: "clientHandle" ,                    fieldType:"IntegerId" },
        { name: "samplingInterval",                 fieldType:"Duration" },
        { name: "filter",                           fieldType:"ExtensionObject" },
        { name: "queueSize",                        fieldType:"Counter" },
        { name: "discardOldest",                    fieldType:"Boolean" }
    ]
};
exports.MonitoringParameters = factories.registerObject(MonitoringParameters_Schema);

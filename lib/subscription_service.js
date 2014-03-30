var factories = require("./factories");
var ReadValueId = require("./read_service").ReadValueId;

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
        { name: "results"        ,  isArray:true, fieldType:"MonitoredItemCreateResult" },
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
        { name: "filter",                           fieldType:"ExtensibleParameterAdditionalHeader" },
        { name: "queueSize",                        fieldType:"Counter" },
        { name: "discardOldest",                    fieldType:"Boolean" }
    ]
};
exports.MonitoringParameters = factories.registerObject(MonitoringParameters_Schema);

var SubscriptionAcknowledgement_Schema = {
    name: "SubscriptionAcknowledgement",
    fields: [
        { name: "subscriptionId" ,                             fieldType:"IntegerId" },
        { name: "sequenceNumber" ,                             fieldType:"Counter" }
    ]
};
exports.SubscriptionAcknowledgement = factories.registerObject(SubscriptionAcknowledgement_Schema);

var PublishRequest_Schema = {
    name: "PublishRequest",
    fields: [
        { name: "requestHeader" ,                             fieldType:"RequestHeader" },
        { name: "subscriptionAcknowledgements", isArray:true, fieldType:"SubscriptionAcknowledgement" }
    ]
};
exports.PublishRequest = factories.registerObject(PublishRequest_Schema);

var PublishResponse_Schema = {
    name: "PublishResponse",
    fields: [
        { name: "responseHeader" ,                            fieldType:"ResponseHeader" },
        { name: "subscriptionId",                             fieldType:"IntegerId" },
        { name: "availableSequenceNumbers", isArray:true,     fieldType:"Counter" ,
              documentation:" a list of sequence number available in the subscription for retransmission and not acknoledged by the client"
        },
        { name: "moreNotifications",                          fieldType:"Boolean" ,
            documentation: "indicates if the server was not able to send all available notification in this publish response"
        },
        { name: "notificationMessage",                        fieldType:"NotificationMessage" },
        { name: "results",                  isArray:true,     fieldType:"StatusCode" },
        { name: "diagnosticInfos",          isArray:true,     fieldType:"DiagnosticInfo" }
    ]
};
exports.PublishResponse = factories.registerObject(PublishResponse_Schema);


var RepublishRequest_Schema = {
    name: "RepublishRequest",
    fields: [
        { name: "requestHeader" ,                             fieldType:"RequestHeader"  },
        { name: "subscriptionId",                             fieldType:"IntegerId" },
        { name: "retransmitSequenceNumber",                   fieldType:"Counter" }
    ]
};
exports.RepublishRequest = factories.registerObject(RepublishRequest_Schema);

var RepublishResponse_Schema = {
    name: "RepublishResponse",
    fields: [
        { name: "responseHeader" ,                         fieldType:"ResponseHeader" },
        { name: "notificationMessage",                     fieldType:"NotificationMessage"}
    ]
};
exports.RepublishResponse = factories.registerObject(RepublishResponse_Schema);

var NotificationMessage_Schema = {
    name: "NotificationMessage",
    fields: [
        { name: "sequenceNumber" ,                  fieldType:"Counter" },
        { name: "publishTime",                      fieldType:"UtcTime"},
        { name: "notificationData", isArray: true,  fieldType:"ExtensionObject"}
        // could be DataChangeNotification or EventNotification
    ]
};
exports.NotificationMessage = factories.registerObject(NotificationMessage_Schema);



var DeleteMonitoredItemsRequest_Schema = {
    name: "DeleteMonitoredItemsRequest",
    fields: [
        { name: "requestHeader" ,                             fieldType:"RequestHeader"  },
        { name: "subscriptionId",                             fieldType:"IntegerId" },
        { name: "monitoredItemIds", isArray:true,             fieldType:"IntegerId" }
    ]
};
exports.DeleteMonitoredItemsRequest = factories.registerObject(DeleteMonitoredItemsRequest_Schema);

var DeleteMonitoredItemsResponse_Schema = {
    name: "DeleteMonitoredItemsResponse",
    fields: [
        { name: "responseHeader" ,                      fieldType:"ResponseHeader" },
        { name: "results",            isArray:true,     fieldType:"StatusCode"     },
        { name: "diagnosticInfos",    isArray:true,     fieldType:"DiagnosticInfo" }
    ]
};
exports.DeleteMonitoredItemsResponse = factories.registerObject(DeleteMonitoredItemsResponse_Schema);


var SetPublishingModeRequest_Schema = {
    name: "SetPublishingModeRequest",
    fields: [
        { name: "requestHeader" ,                            fieldType:"RequestHeader"  },
        { name: "publishingEnabled",                         fieldType:"Boolean" },
        { name: "subscriptionIds", isArray:true,             fieldType:"IntegerId" }
    ]
};
exports.SetPublishingModeRequest = factories.registerObject(SetPublishingModeRequest_Schema);

var SetPublishingModeResponse_Schema = {
    name: "SetPublishingModeResponse",
    fields: [
        { name: "responseHeader" ,                      fieldType:"ResponseHeader" },
        { name: "results",            isArray:true,     fieldType:"StatusCode"     },
        { name: "diagnosticInfos",    isArray:true,     fieldType:"DiagnosticInfo" }
    ]
};
exports.SetPublishingModeResponse = factories.registerObject(SetPublishingModeResponse_Schema);

// TODO: DeleteSubscriptionsRequest
var DeleteSubscriptionsRequest_Schema = {
    name: "DeleteSubscriptionsRequest",
    fields: [
        { name: "requestHeader" ,                             fieldType:"RequestHeader"  },
        { name: "subscriptionIds", isArray:true,             fieldType:"IntegerId" }
    ]
};
exports.DeleteSubscriptionsRequest = factories.registerObject(DeleteSubscriptionsRequest_Schema);

var DeleteSubscriptionsResponse_Schema = {
    name: "DeleteSubscriptionsResponse",
    fields: [
        { name: "responseHeader" ,                      fieldType:"ResponseHeader" },
        { name: "results",            isArray:true,     fieldType:"StatusCode"     },
        { name: "diagnosticInfos",    isArray:true,     fieldType:"DiagnosticInfo" }
    ]
};
exports.DeleteSubscriptionsResponse = factories.registerObject(DeleteSubscriptionsResponse_Schema);



var MonitoredItemNotification_Schema = {
    name: "MonitoredItemNotification",
    fields: [
        { name: "clientHandle" , fieldType: "IntegerId"},
        { name: "value" ,        fieldType: "DataValue"}
    ]
};

exports.MonitoredItemNotification = factories.registerObject(MonitoredItemNotification_Schema);


var DataChangeNotification_Schema = {
    name: "DataChangeNotification",
    //  BaseType="NotificationData"
    fields: [
        { name: "monitoredItems",  isArray:true, fieldType: "MonitoredItemNotification" },
        { name: "diagnosticInfos", isArray:true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DataChangeNotification = factories.registerObject(DataChangeNotification_Schema);


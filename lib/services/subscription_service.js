var factories = require("./../misc/factories");
var ReadValueId = require("./read_service").ReadValueId;

var CreateSubscriptionRequest_Schema = {
    name: "CreateSubscriptionRequest",
    fields: [

        { name: "requestHeader", fieldType: "RequestHeader" },

        // This interval defines the cyclic rate that the Subscription is being requested to
        // return Notifications to the Client. This interval is expressed in milliseconds. This
        // interval is represented by the publishing timer in the Subscription state table (see
        // 5.13.1.2).
        // The negotiated value for this parameter returned in the response is used as the
        // default sampling interval for MonitoredItems assigned to this Subscription.
        // If the requested value is 0 or negative, the server shall revise with the fastest
        // supported publishing interval.
        { name: "requestedPublishingInterval", fieldType: "Duration"},

        // Requested lifetime count
        //   The lifetime count shall be a minimum of three times the keep keep-alive count.
        //   When the publishing timer has expired this number of times without a Publish
        //   request being available to send a NotificationMessage, then the Subscription
        //   shall be deleted by the Server.
        { name: "requestedLifetimeCount", fieldType: "Counter"},

        // Requested maximum keep-alive count.
        //   When the publishing timer has expired this number of times without requiring any
        //   NotificationMessage to be sent, the Subscription sends a keep-alive Message to
        //   the Client. The value 0 is invalid.
        { name: "requestedMaxKeepAliveCount", fieldType: "Counter"},

        // The maximum number of notifications that the Client wishes to receive in a
        // single Publish response. A value of zero indicates that there is no limit.
        { name: "maxNotificationsPerPublish", fieldType: "Counter"},

        { name: "publishingEnabled", fieldType: "Boolean"},
        { name: "priority", fieldType: "Byte"}
    ]
};
exports.CreateSubscriptionRequest_Schema = CreateSubscriptionRequest_Schema;
exports.CreateSubscriptionRequest = factories.registerObject(CreateSubscriptionRequest_Schema);


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
exports.CreateSubscriptionResponse = factories.registerObject(CreateSubscriptionResponse_Schema);


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
exports.ModifySubscriptionRequest = factories.registerObject(ModifySubscriptionRequest_Schema);

var ModifySubscriptionResponse_Schema = {
    name: "ModifySubscriptionResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "revisedPublishingInterval", fieldType: "Duration" },
        { name: "revisedLifetimeCount", fieldType: "Counter" },
        { name: "revisedMaxKeepAliveCount", fieldType: "Counter" }
    ]
};
exports.ModifySubscriptionResponse_Schema = ModifySubscriptionResponse_Schema;
exports.ModifySubscriptionResponse = factories.registerObject(ModifySubscriptionResponse_Schema);

var MonitoringMode_Schema = {
    name: "MonitoringMode",
    enumValues: {
        Disabled: 0,
        Sampling: 1,
        Reporting: 2
    }
};
exports.MonitoringMode_Schema = MonitoringMode_Schema;
exports.MonitoringMode = factories.registerEnumeration(MonitoringMode_Schema);


var MonitoringParameters_Schema = {
    name: "MonitoringParameters",
    fields: [
        { name: "clientHandle", fieldType: "IntegerId" },
        { name: "samplingInterval", fieldType: "Duration" },
        { name: "filter", fieldType: "ExtensibleParameterAdditionalHeader" },
        { name: "queueSize", fieldType: "Counter" },
        { name: "discardOldest", fieldType: "Boolean" }
    ]
};
exports.MonitoringParameters_Schema = MonitoringParameters_Schema;
exports.MonitoringParameters = factories.registerObject(MonitoringParameters_Schema);

var MonitoredItemCreateRequest_Schema = {
    name: "MonitoredItemCreateRequest",
    fields: [
        { name: "itemToMonitor", fieldType: "ReadValueId" },
        { name: "monitoringMode", fieldType: "MonitoringMode" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
exports.MonitoredItemCreateRequest_Schema = MonitoredItemCreateRequest_Schema;
exports.MonitoredItemCreateRequest = factories.registerObject(MonitoredItemCreateRequest_Schema);


var CreateMonitoredItemsRequest_Schema = {
    name: "CreateMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "timestampsToReturn", fieldType: "TimestampsToReturn" },
        { name: "itemsToCreate", isArray: true, fieldType: "MonitoredItemCreateRequest" }
    ]
};
exports.CreateMonitoredItemsRequest_Schema = CreateMonitoredItemsRequest_Schema;
exports.CreateMonitoredItemsRequest = factories.registerObject(CreateMonitoredItemsRequest_Schema);


var MonitoredItemCreateResult_Schema = {
    name: "MonitoredItemCreateResult",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "monitoredItemId", fieldType: "IntegerId" },
        { name: "revisedSamplingInterval", fieldType: "Duration" },
        { name: "revisedQueueSize", fieldType: "Counter" },
        { name: "filterResult", fieldType: "ExtensionObject" }
    ]
};
exports.MonitoredItemCreateResult_Schema = MonitoredItemCreateResult_Schema;
exports.MonitoredItemCreateResult = factories.registerObject(MonitoredItemCreateResult_Schema);


var CreateMonitoredItemsResponse_Schema = {
    name: "CreateMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "MonitoredItemCreateResult" }
        // { name: "diagnosticInfos", isArray:true,  fieldType:"DiagnosticInfo" }
    ]
};
exports.CreateMonitoredItemsResponse_Schema = CreateMonitoredItemsResponse_Schema;
exports.CreateMonitoredItemsResponse = factories.registerObject(CreateMonitoredItemsResponse_Schema);


var SubscriptionAcknowledgement_Schema = {
    name: "SubscriptionAcknowledgement",
    fields: [
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "sequenceNumber", fieldType: "Counter" }
    ]
};
exports.SubscriptionAcknowledgement_Schema = SubscriptionAcknowledgement_Schema;
exports.SubscriptionAcknowledgement = factories.registerObject(SubscriptionAcknowledgement_Schema);

var PublishRequest_Schema = {
    name: "PublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionAcknowledgements", isArray: true, fieldType: "SubscriptionAcknowledgement" }
    ]
};
exports.PublishRequest_Schema = PublishRequest_Schema;
exports.PublishRequest = factories.registerObject(PublishRequest_Schema);


var NotificationMessage_Schema = {
    name: "NotificationMessage",
    fields: [
        { name: "sequenceNumber", fieldType: "Counter" },
        { name: "publishTime", fieldType: "UtcTime"},
        { name: "notificationData", isArray: true, fieldType: "ExtensionObject"}
        // could be DataChangeNotification or EventNotification
    ]
};
exports.NotificationMessage_Schema = NotificationMessage_Schema;
exports.NotificationMessage = factories.registerObject(NotificationMessage_Schema);


var PublishResponse_Schema = {
    name: "PublishResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "availableSequenceNumbers", isArray: true, fieldType: "Counter",
            documentation: " a list of sequence number available in the subscription for retransmission and not acknoledged by the client"
        },
        { name: "moreNotifications", fieldType: "Boolean",
            documentation: "indicates if the server was not able to send all available notification in this publish response"
        },
        { name: "notificationMessage", fieldType: "NotificationMessage" },
        { name: "results", isArray: true, fieldType: "StatusCode" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.PublishResponse_Schema = PublishResponse_Schema;
exports.PublishResponse = factories.registerObject(PublishResponse_Schema);


var RepublishRequest_Schema = {
    name: "RepublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "retransmitSequenceNumber", fieldType: "Counter" }
    ]
};
exports.RepublishRequest_Schema = RepublishRequest_Schema;
exports.RepublishRequest = factories.registerObject(RepublishRequest_Schema);

var RepublishResponse_Schema = {
    name: "RepublishResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "notificationMessage", fieldType: "NotificationMessage"}
    ]
};
exports.RepublishResponse_Schema = RepublishResponse_Schema;
exports.RepublishResponse = factories.registerObject(RepublishResponse_Schema);



var DeleteMonitoredItemsRequest_Schema = {
    name: "DeleteMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "monitoredItemIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.DeleteMonitoredItemsRequest_Schema = DeleteMonitoredItemsRequest_Schema;
exports.DeleteMonitoredItemsRequest = factories.registerObject(DeleteMonitoredItemsRequest_Schema);

var DeleteMonitoredItemsResponse_Schema = {
    name: "DeleteMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DeleteMonitoredItemsResponse_Schema = DeleteMonitoredItemsResponse_Schema;
exports.DeleteMonitoredItemsResponse = factories.registerObject(DeleteMonitoredItemsResponse_Schema);


var SetPublishingModeRequest_Schema = {
    name: "SetPublishingModeRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "publishingEnabled", fieldType: "Boolean" },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.SetPublishingModeRequest_Schema = SetPublishingModeRequest_Schema;
exports.SetPublishingModeRequest = factories.registerObject(SetPublishingModeRequest_Schema);

var SetPublishingModeResponse_Schema = {
    name: "SetPublishingModeResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.SetPublishingModeResponse_Schema = SetPublishingModeResponse_Schema;
exports.SetPublishingModeResponse = factories.registerObject(SetPublishingModeResponse_Schema);

// TODO: DeleteSubscriptionsRequest
var DeleteSubscriptionsRequest_Schema = {
    name: "DeleteSubscriptionsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.DeleteSubscriptionsRequest_Schema = DeleteSubscriptionsRequest_Schema;
exports.DeleteSubscriptionsRequest = factories.registerObject(DeleteSubscriptionsRequest_Schema);

var DeleteSubscriptionsResponse_Schema = {
    name: "DeleteSubscriptionsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DeleteSubscriptionsResponse_Schema = DeleteSubscriptionsResponse_Schema;
exports.DeleteSubscriptionsResponse = factories.registerObject(DeleteSubscriptionsResponse_Schema);


var MonitoredItemNotification_Schema = {
    name: "MonitoredItemNotification",
    fields: [
        { name: "clientHandle", fieldType: "IntegerId"},
        { name: "value", fieldType: "DataValue"}
    ]
};

exports.MonitoredItemNotification_Schema = MonitoredItemNotification_Schema;
exports.MonitoredItemNotification = factories.registerObject(MonitoredItemNotification_Schema);


var DataChangeNotification_Schema = {
    name: "DataChangeNotification",
    //  BaseType="NotificationData"
    fields: [
        { name: "monitoredItems", isArray: true, fieldType: "MonitoredItemNotification" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DataChangeNotification_Schema = DataChangeNotification_Schema;
exports.DataChangeNotification = factories.registerObject(DataChangeNotification_Schema);




var MonitoredItemModifyRequest_Schema = {
    name: "MonitoredItemModifyRequest",
    fields: [
        { name: "monitoredItemId", fieldType: "IntegerId" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
exports.MonitoredItemModifyRequest_Schema = MonitoredItemModifyRequest_Schema;
exports.MonitoredItemModifyRequest = factories.registerObject(MonitoredItemModifyRequest_Schema);

var MonitoredItemModifyResult_Schema = {
    name: "MonitoredItemModifyResult",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "revisedSamplingInterval", fieldType: "Duration" },
        { name: "revisedQueueSize", fieldType: "Counter" },
        { name: "filterResult", fieldType: "ExtensibleParameterAdditionalHeader" }
    ]
};
exports.MonitoredItemModifyResult_Schema = MonitoredItemModifyResult_Schema;
exports.MonitoredItemModifyResult = factories.registerObject(MonitoredItemModifyResult_Schema);


var ModifyMonitoredItemsRequest_Schema = {
    name: "ModifyMonitoredItemsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "timestampsToReturn", fieldType: "TimestampsToReturn" },
        { name: "itemsToModify", isArray: true, fieldType: "MonitoredItemModifyRequest" }
    ]
};
exports.ModifyMonitoredItemsRequest_Schema = ModifyMonitoredItemsRequest_Schema;
exports.ModifyMonitoredItemsRequest = factories.registerObject(ModifyMonitoredItemsRequest_Schema);

var ModifyMonitoredItemsResponse_Schema = {
    name: "ModifyMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.ModifyMonitoredItemsResponse_Schema = ModifyMonitoredItemsResponse_Schema;
exports.ModifyMonitoredItemsResponse = factories.registerObject(ModifyMonitoredItemsResponse_Schema);


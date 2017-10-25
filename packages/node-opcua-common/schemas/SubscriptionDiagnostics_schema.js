var SubscriptionDiagnostics_Schema = {
    id: "ns=0;i=876",
    name: "SubscriptionDiagnostics",
    fields: [
       {
           name: "sessionId",
           fieldType: "NodeId"
       },
       {
           name: "subscriptionId",
           fieldType: "UInt32"
       },
       {
           name: "priority",
           fieldType: "Byte"
       },
       {
           name: "publishingInterval",
           fieldType: "Double"
       },
       {
           name: "maxKeepAliveCount",
           fieldType: "UInt32"
       },
       {
           name: "maxLifetimeCount",
           fieldType: "UInt32"
       },
       {
           name: "maxNotificationsPerPublish",
           fieldType: "UInt32"
       },
       {
           name: "publishingEnabled",
           fieldType: "Boolean"
       },
       {
           name: "modifyCount",
           fieldType: "UInt32"
       },
       {
           name: "enableCount",
           fieldType: "UInt32"
       },
       {
           name: "disableCount",
           fieldType: "UInt32"
       },
       {
           name: "republishRequestCount",
           fieldType: "UInt32"
       },
       {
           name: "republishMessageRequestCount",
           fieldType: "UInt32"
       },
       {
           name: "republishMessageCount",
           fieldType: "UInt32"
       },
       {
           name: "transferRequestCount",
           fieldType: "UInt32"
       },
       {
           name: "transferredToAltClientCount",
           fieldType: "UInt32"
       },
       {
           name: "transferredToSameClientCount",
           fieldType: "UInt32"
       },
       {
           name: "publishRequestCount",
           fieldType: "UInt32"
       },
       {
           name: "dataChangeNotificationsCount",
           fieldType: "UInt32"
       },
       {
           name: "eventNotificationsCount",
           fieldType: "UInt32"
       },
       {
           name: "notificationsCount",
           fieldType: "UInt32"
       },
       {
           name: "latePublishRequestCount",
           fieldType: "UInt32"
       },
       {
           name: "currentKeepAliveCount",
           fieldType: "UInt32"
       },
       {
           name: "currentLifetimeCount",
           fieldType: "UInt32"
       },
       {
           name: "unacknowledgedMessageCount",
           fieldType: "UInt32"
       },
       {
           name: "discardedMessageCount",
           fieldType: "UInt32"
       },
       {
           name: "monitoredItemCount",
           fieldType: "UInt32"
       },
       {
           name: "disabledMonitoredItemCount",
           fieldType: "UInt32"
       },
       {
           name: "monitoringQueueOverflowCount",
           fieldType: "UInt32"
       },
       {
           name: "nextSequenceNumber",
           fieldType: "UInt32"
       },
       {
           name: "eventQueueOverFlowCount",
           fieldType: "UInt32"
       },
        ]
    };
exports.SubscriptionDiagnostics_Schema = SubscriptionDiagnostics_Schema;
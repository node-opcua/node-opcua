require("node-opcua-service-endpoints");
require("node-opcua-nodeid");

var SessionDiagnostics_Schema = {
    id: "ns=0;i=867",
    name: "SessionDiagnostics",
    fields: [
        {
            name: "sessionId",
            fieldType: "NodeId"
        },
        {
            name: "sessionName",
            fieldType: "String"
        },
        {
            name: "clientDescription",
            fieldType: "ApplicationDescription"
        },
        {
            name: "serverUri",
            fieldType: "String"
        },
        {
            name: "endpointUrl",
            fieldType: "String"
        },
        {
            name: "localeIds",
            fieldType: "LocaleId"
        },
        {
            name: "actualSessionTimeout",
            fieldType: "Duration"
        },
        {
            name: "maxResponseMessageSize",
            fieldType: "UInt32"
        },
        {
            name: "clientConnectionTime",
            fieldType: "UtcTime"
        },
        {
            name: "clientLastContactTime",
            fieldType: "UtcTime"
        },
        {
            name: "currentSubscriptionsCount",
            fieldType: "UInt32"
        },
        {
            name: "currentMonitoredItemsCount",
            fieldType: "UInt32"
        },
        {
            name: "currentPublishRequestsInQueue",
            fieldType: "UInt32"
        },
        {
            name: "totalRequestCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "unauthorizedRequestCount",
            fieldType: "UInt32"
        },
        {
            name: "readCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "historyReadCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "writeCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "historyUpdateCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "callCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "createMonitoredItemsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "modifyMonitoredItemsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "setMonitoringModeCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "setTriggeringCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "deleteMonitoredItemsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "createSubscriptionCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "modifySubscriptionCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "setPublishingModeCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "publishCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "republishCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "transferSubscriptionsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "deleteSubscriptionsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "addNodesCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "addReferencesCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "deleteNodesCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "deleteReferencesCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "browseCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "browseNextCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "translateBrowsePathsToNodeIdsCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "queryFirstCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "queryNextCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "registerNodesCount",
            fieldType: "ServiceCounter"
        },
        {
            name: "unregisterNodesCount",
            fieldType: "ServiceCounter"
        }
    ]
};
exports.SessionDiagnostics_Schema = SessionDiagnostics_Schema;


var PublishResponse_Schema = {
    name: "PublishResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "availableSequenceNumbers", isArray: true, fieldType: "Counter",
            documentation: " a list of sequence number available in the subscription for retransmission and not acknowledged by the client"
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


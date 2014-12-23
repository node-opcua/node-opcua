
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
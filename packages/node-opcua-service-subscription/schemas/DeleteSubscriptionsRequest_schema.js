require("node-opcua-service-secure-channel");

var DeleteSubscriptionsRequest_Schema = {
    name: "DeleteSubscriptionsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.DeleteSubscriptionsRequest_Schema = DeleteSubscriptionsRequest_Schema;

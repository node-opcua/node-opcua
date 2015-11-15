var TransferSubscriptionsRequest_Schema = {
    name: "TransferSubscriptionsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId"},
        { name: "sendInitialValues",              fieldType: "Boolean"},

    ]
};
exports.TransferSubscriptionsRequest_Schema = TransferSubscriptionsRequest_Schema;

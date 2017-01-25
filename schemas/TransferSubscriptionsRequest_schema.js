const TransferSubscriptionsRequest_Schema = {
    name: "TransferSubscriptionsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader" },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId"},
        { name: "sendInitialValues",              fieldType: "Boolean"},

    ]
};
export {TransferSubscriptionsRequest_Schema};

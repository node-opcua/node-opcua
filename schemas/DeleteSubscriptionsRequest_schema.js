// TODO: DeleteSubscriptionsRequest
const DeleteSubscriptionsRequest_Schema = {
    name: "DeleteSubscriptionsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionIds", isArray: true, fieldType: "IntegerId" }
    ]
};
export {DeleteSubscriptionsRequest_Schema};

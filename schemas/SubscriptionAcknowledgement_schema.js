

const SubscriptionAcknowledgement_Schema = {
    name: "SubscriptionAcknowledgement",
    fields: [
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "sequenceNumber", fieldType: "Counter" }
    ]
};
export {SubscriptionAcknowledgement_Schema};

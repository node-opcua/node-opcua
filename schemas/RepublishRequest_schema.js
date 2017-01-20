
const RepublishRequest_Schema = {
    name: "RepublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "retransmitSequenceNumber", fieldType: "Counter" }
    ]
};
export {RepublishRequest_Schema};


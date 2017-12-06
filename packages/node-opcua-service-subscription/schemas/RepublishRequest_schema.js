
var RepublishRequest_Schema = {
    name: "RepublishRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        { name: "subscriptionId", fieldType: "IntegerId" },
        { name: "retransmitSequenceNumber", fieldType: "Counter" }
    ]
};
exports.RepublishRequest_Schema = RepublishRequest_Schema;


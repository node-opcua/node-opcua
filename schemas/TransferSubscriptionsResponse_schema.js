var TransferSubscriptionsResponse_Schema = {
    name: "TransferSubscriptionsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results",            isArray: true, fieldType: "TransferResult"     },
        { name: "diagnosticInfos",    isArray: true, fieldType: "DiagnosticInfo" },
    ]
};
exports.TransferSubscriptionsResponse_Schema = TransferSubscriptionsResponse_Schema;
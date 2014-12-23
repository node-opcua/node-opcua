var DeleteSubscriptionsResponse_Schema = {
    name: "DeleteSubscriptionsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DeleteSubscriptionsResponse_Schema = DeleteSubscriptionsResponse_Schema;
var SetPublishingModeResponse_Schema = {
    name: "SetPublishingModeResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.SetPublishingModeResponse_Schema = SetPublishingModeResponse_Schema;
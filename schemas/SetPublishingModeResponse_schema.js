const SetPublishingModeResponse_Schema = {
    name: "SetPublishingModeResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
export {SetPublishingModeResponse_Schema};
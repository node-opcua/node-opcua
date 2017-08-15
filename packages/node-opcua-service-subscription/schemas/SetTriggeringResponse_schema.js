var SetTriggeringResponse_Schema = {
    name: "SetTriggeringResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        { name: "addResults",            isArray: true, fieldType: "StatusCode"     },
        { name: "addDiagnosticInfos",    isArray: true, fieldType: "DiagnosticInfo" },
        { name: "removeResults",         isArray: true, fieldType: "StatusCode"     },
        { name: "removeDiagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.SetTriggeringResponse_Schema = SetTriggeringResponse_Schema;
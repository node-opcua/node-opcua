
const ContentFilterElementResult_Schema = {
    name: "ContentFilterElementResult",
    //baseType: "MonitoringFilter",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "operandStatusCodes", isArrays: true, fieldType: "StatusCode"},
        { name: "operandDiagnosticInfos", isArrays: true, fieldType: "DiagnosticInfo" }
    ]
};

export {ContentFilterElementResult_Schema};
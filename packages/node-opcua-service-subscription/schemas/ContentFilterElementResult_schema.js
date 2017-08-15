
var ContentFilterElementResult_Schema = {
    name: "ContentFilterElementResult",
    //baseType: "MonitoringFilter",
    fields: [
        { name: "statusCode", fieldType: "StatusCode" },
        { name: "operandStatusCodes", isArrays: true, fieldType: "StatusCode"},
        { name: "operandDiagnosticInfos", isArrays: true, fieldType: "DiagnosticInfo" }
    ]
};

exports.ContentFilterElementResult_Schema = ContentFilterElementResult_Schema;
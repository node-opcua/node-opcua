var WriteResponse_Schema = {
    name: "WriteResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader" },
        { name: "results",         isArray:true,  fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};
exports.WriteResponse_Schema = WriteResponse_Schema;


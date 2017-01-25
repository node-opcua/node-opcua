const WriteResponse_Schema = {
    name: "WriteResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader" },
        { name: "results",         isArray:true,  fieldType: "StatusCode"     },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};
export {WriteResponse_Schema};


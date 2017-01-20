const QueryFirstResponse_Schema = {
    name: "QueryFirstResponse",
    fields: [
        { name: "responseHeader",                   fieldType: "ResponseHeader" },
        { name: "queryDataSet",      isArray: true, fieldType: "QueryDataSet" },
        { name: "continuationPoint",                fieldType: "ContinuationPoint" },
        { name: "parsingResult",    isArray: true,  fieldType: "ParsingResult" },
        { name: "diagnosticInfos",  isArray: true,  fieldType: "DiagnosticInfo" },
        { name: "filterResult" ,                    fieldType: "ContentFilterResult"}
    ]
};
export {QueryFirstResponse_Schema};


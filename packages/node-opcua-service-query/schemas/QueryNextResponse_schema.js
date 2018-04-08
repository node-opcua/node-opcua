require("node-opcua-service-secure-channel");

const QueryNextResponse_Schema = {
    name: "QueryNextResponse",
    fields: [
        { name: "responseHeader",                   fieldType: "ResponseHeader" },
        { name: "queryDataSet",      isArray: true, fieldType: "QueryDataSet" },
        { name: "revisedContinuationPoint",         fieldType: "ContinuationPoint" },
    ]
};
exports.QueryNextResponse_Schema = QueryNextResponse_Schema;


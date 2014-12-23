var ReadResponse_Schema = {
    name: "ReadResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader"},
        {
            name: "results",          isArray:true, fieldType: "DataValue",
            documentation: "List of Attribute values as DataValue. The size and order of this list matches the size and"+
            " order of the nodesToRead request parameter. There is one entry in this list for each Node "+
            " contained in the nodesToRead parameter."
        },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};
exports.ReadResponse_Schema = ReadResponse_Schema;


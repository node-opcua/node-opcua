var HistoryReadValueId_Schema = {
    name: "HistoryReadValueId",
    // baseType: "ExtensionObject"
    fields: [
        {   name: "nodeId", fieldType: "NodeId"},
        {   name: "indexRange", fieldType: "String"},
        {   name: "dataEncoding", fieldType: "QualifiedName"},
        {   name: "continuationPoint", fieldType: "ByteString",default:null}
    ]
};
exports.HistoryReadValueId_Schema = HistoryReadValueId_Schema;
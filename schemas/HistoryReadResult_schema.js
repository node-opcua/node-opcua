
var HistoryReadResult_Schema = {
    name: "HistoryReadResult",
    fields: [
        { name: "statusCode", fieldType:"StatusCode" },
        { name: "continuationPoint", fieldType:"ByteString" ,default:null},
        { name: "historyData", fieldType:"ExtensionObject"}
    ]
};
exports.HistoryReadResult_Schema = HistoryReadResult_Schema;
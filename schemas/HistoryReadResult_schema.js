
var HistoryReadResult_Schema = {
    name: "HistoryReadResult",
    fields: [
        { name: "StatusCode", fieldType:"StatusCode" },
        { name: "ContinuationPoint", fieldType:"ByteString" ,default:null},
        { name: "HistoryData", fieldType:"ExtensionObject"}
    ]
};
exports.HistoryReadResult_Schema = HistoryReadResult_Schema;
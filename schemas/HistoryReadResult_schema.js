
var HistoryReadResult_Schema = {
    name: "HistoryReadResult",
    fields: [
        { name: "StatusCode", fieldType:"StatusCode" },
        { name: "ContinuationPoint", fieldType:"ByteString" },
        { name: "HistoryData", fieldType:"ExtensionObject"}
    ]
};
exports.HistoryReadResult_Schema = HistoryReadResult_Schema;

const HistoryReadResult_Schema = {
    name: "HistoryReadResult",
    fields: [
        { name: "statusCode", fieldType:"StatusCode" },
        { name: "continuationPoint", fieldType:"ByteString" ,defaultValue:null},
        { name: "historyData", fieldType:"ExtensionObject"}
    ]
};
export {HistoryReadResult_Schema};
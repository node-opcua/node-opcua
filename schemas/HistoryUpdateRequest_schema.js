var HistoryUpdateRequest_Schema = {
    name:"HistoryUpdateRequest",
    fields:[
        {   name: "requestHeader", fieldType: "RequestHeader"},
        { name: "historyUpdateDetails", isArray: true, fieldType:"ExtensionObject"}
    ]
};
exports.HistoryUpdateRequest_Schema = HistoryUpdateRequest_Schema;

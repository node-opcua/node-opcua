const HistoryUpdateRequest_Schema = {
    name:"HistoryUpdateRequest",
    fields:[
        {   name: "requestHeader", fieldType: "RequestHeader"},
        { name: "historyUpdateDetails", isArray: true, fieldType:"ExtensionObject"}
    ]
};
export {HistoryUpdateRequest_Schema};

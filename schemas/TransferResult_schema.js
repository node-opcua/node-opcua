const TransferResult_Schema= {
    name:"TransferResult",
    fields: [
        { name:"statusCode",                             fieldType:"StatusCode"},
        { name:"availableSequenceNumbers", isArray:true, fieldType:"Counter"}
    ]
};
export {TransferResult_Schema};
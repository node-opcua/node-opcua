var TransferResult_Schema= {
    name:"TransferResult",
    fields: [
        { name:"statusCode",                             fieldType:"StatusCode"},
        { name:"availableSequenceNumbers", isArray:true, fieldType:"Counter"}
    ]
};
exports.TransferResult_Schema = TransferResult_Schema;
var WriteRequest_Schema = {
    name: "WriteRequest",
    fields: [
        { name: "requestHeader" ,               fieldType: "RequestHeader"},
        { name: "nodesToWrite", isArray:true,   fieldType: "WriteValue" }
    ]
};
exports.WriteRequest_Schema = WriteRequest_Schema;
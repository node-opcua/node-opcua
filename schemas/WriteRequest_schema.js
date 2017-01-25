const WriteRequest_Schema = {
    name: "WriteRequest",
    fields: [
        { name: "requestHeader" ,               fieldType: "RequestHeader"},
        { name: "nodesToWrite", isArray:true,   fieldType: "WriteValue" }
    ]
};
export {WriteRequest_Schema};
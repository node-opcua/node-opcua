var CancelResponse_Schema =  {
    documentation: "Closes a session with the server.",
    name: "CancelResponse",
    fields: [
        { name:"responseHeader",        fieldType:"ResponseHeader",  documentation:"A standard header included in all responses returned by servers."},
        { name:"CancelCount",           fieldType:"UInt32",          documentation:"The number of requests successfully cancelled."}
    ]
};
exports.CancelResponse_Schema = CancelResponse_Schema;

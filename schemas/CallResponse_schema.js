

var CallResponse_Schema = {
    name: "CallResponse",
    documentation: "This Service is used to call (invoke) a list of Methods.",
    fields: [
        // Common response parameters (see 7.27 for ResponseHeader definition).
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},

        {name: "results", fieldType: "CallMethodResult" , isArray:true,documentation:"Result for the Method calls." }
    ]
};
exports.CallResponse_Schema = CallResponse_Schema;

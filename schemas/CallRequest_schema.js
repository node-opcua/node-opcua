

var CallRequest_Schema = {
    name: "CallRequest",
    documentation: "This Service is used to call (invoke) a list of Methods.",
    fields: [
        // requestHeader Common request parameters (see 7.26 for RequestHeader)
        {name: "requestHeader", fieldType: "RequestHeader", documentation: "A standard header included in all requests sent to a server. "},
        {name: "methodsToCall" ,fieldType: "CallMethodRequest", isArray: true, documentation: "List of Methods to call."}
    ]
};
exports.CallRequest_Schema = CallRequest_Schema;


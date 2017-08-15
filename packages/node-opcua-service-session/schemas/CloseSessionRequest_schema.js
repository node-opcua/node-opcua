var CloseSessionRequest_Schema =  {
    documentation: "Closes a session with the server.",
    name: "CloseSessionRequest",
    fields: [
        { name:"requestHeader",        fieldType:"RequestHeader",  documentation:"A standard header included in all requests sent to a server."},
        { name:"deleteSubscriptions",  fieldType:"Boolean",         documentation:"If TRUE all subscriptions are deleted when the session is closed."}
    ]
};
exports.CloseSessionRequest_Schema = CloseSessionRequest_Schema;